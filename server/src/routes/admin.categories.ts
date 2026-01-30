import { Router } from "express";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Category } from "../models";
import { z } from "zod";
import multer from "multer";
import { Op } from "sequelize";

const router = Router();

// helpers
function parseBool(v: any): boolean | undefined {
  if (v === undefined) return undefined;
  const s = String(v).toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return undefined;
}

// GET /api/admin/categories
// supports: q, page, pageSize, parentsOnly, published, sort (e.g. "created_at:desc")
router.get("/", requireStaffOrAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || req.query.pageSize || 10), 10))
    );
    const parentsOnly = parseBool(req.query.parentsOnly);
    const published = parseBool(req.query.published);
    const sort = String(req.query.sort || "created_at:desc");
    const [sortKey, sortDirRaw] = sort.split(":");
    const sortDir = (sortDirRaw || "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";

    const where: any = {};
    if (q) where.name = { [Op.like]: `%${q}%` };
    if (parentsOnly === true) where.parent_id = { [Op.is]: null };
    if (published !== undefined) where.published = published;

    const offset = (page - 1) * limit;
    const { rows, count } = await Category.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortKey, sortDir]],
      include: [{ model: Category, as: "parent", attributes: ["id", "name", "code"] }],
    });
    res.json({
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const body = z
      .object({
        code: z.string().max(32).optional(),
        name: z.string().min(1),
        description: z.string().max(255).optional(),
        icon: z.string().max(255).optional(),
        parent_id: z.number().int().positive().optional(),
        published: z.boolean().optional(),
      })
      .parse(req.body);

    const code = body.code || Math.random().toString(36).slice(2, 6).toUpperCase();

    const created = await Category.create({
      code,
      name: body.name,
      description: body.description,
      icon: body.icon,
      parentId: body.parent_id,
      published: body.published ?? true,
    } as any);
    res.status(201).json({ data: created });
  } catch (err) {
    // Handle race condition with DB unique constraint
    if ((err as any)?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: "Category code already exists" });
    }
    next(err);
  }
});

// GET /api/admin/categories/:id
router.get("/:id", requireStaffOrAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cat = await Category.findByPk(id, {
      include: [{ model: Category, as: "parent", attributes: ["id", "name", "code"] }],
    });
    if (!cat) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ data: cat });
  } catch (err) {
    next(err);
  }
});

// helper: prevent cycles when changing parent
async function wouldCauseCycle(id: number, parentId?: number | null) {
  if (!parentId) return false;
  if (parentId === id) return true;
  let cur = await Category.findByPk(parentId);
  while (cur && (cur as any).parentId) {
    if ((cur as any).parentId === id) return true;
    cur = await Category.findByPk((cur as any).parentId);
  }
  return false;
}

// PATCH /api/admin/categories/:id
router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = z
      .object({
        code: z.string().max(32).optional(),
        name: z.string().min(1),
        description: z.string().max(255).optional(),
        icon: z.string().max(255).optional(),
        parent_id: z.number().int().positive().nullable().optional(),
        published: z.boolean().optional(),
      })
      .parse(req.body);
    const cat = await Category.findByPk(id);
    if (!cat) return res.status(404).json({ success: false, message: "Not found" });
    if (await wouldCauseCycle(id, body.parent_id as any)) {
      return res.status(400).json({ success: false, message: "Invalid parent_id: cycle detected" });
    }
    await cat.update({
      code: body.code ?? (cat as any).code,
      name: body.name,
      description: body.description,
      icon: body.icon,
      parentId: body.parent_id as any,
      published: body.published ?? (cat as any).published,
    } as any);
    res.json({ data: cat });
  } catch (err) {
    if ((err as any)?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: "Category code already exists" });
    }
    next(err);
  }
});

// PATCH /api/admin/categories/:id/publish
router.patch("/:id/publish", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { published } = z.object({ published: z.boolean() }).parse(req.body);
    const cat = await Category.findByPk(id);
    if (!cat) return res.status(404).json({ success: false, message: "Not found" });
    await (cat as any).update({ published });
    res.json({ data: cat });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/categories/:id
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cat = await Category.findByPk(id);
    if (!cat) return res.status(404).json({ success: false, message: "Not found" });
    await cat.destroy();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories/bulk
router.post("/bulk", requireAdmin, async (req, res, next) => {
  try {
    const body = z
      .object({
        action: z.enum(["delete", "publish", "unpublish"]),
        ids: z.array(z.number().int().positive()),
      })
      .parse(req.body);
    if (body.action === "delete") {
      await Category.destroy({ where: { id: { [Op.in]: body.ids } } as any });
    } else if (body.action === "publish") {
      await Category.update({ published: true } as any, { where: { id: { [Op.in]: body.ids } } as any });
    } else if (body.action === "unpublish") {
      await Category.update({ published: false } as any, { where: { id: { [Op.in]: body.ids } } as any });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// CSV export/import
function toCsvValue(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get("/export", async (_req, res, next) => {
  try {
    const rows = await Category.findAll({ include: [{ model: Category, as: "parent", attributes: ["code"] }] });
    const header = "code,name,description,icon,published,parent_code\n";
    const body = rows
      .map((r: any) =>
        [r.code, r.name, r.description ?? "", r.icon ?? "", r.published ? "true" : "false", r.parent?.code ?? ""]
          .map(toCsvValue)
          .join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=categories.csv");
    res.send(header + body + "\n");
  } catch (err) {
    next(err);
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
router.post("/import", upload.single("file"), async (req, res, next) => {
  try {
    const buf = req.file?.buffer;
    if (!buf) return res.status(400).json({ success: false, message: "No file uploaded" });
    const text = buf.toString("utf8").trim();
    const lines = text.split(/\r?\n/);
    const header = lines.shift();
    if (!header || !/^code,?name,?description,?icon,?published,?parent_code/i.test(header.replace(/\s+/g, ""))) {
      return res.status(400).json({ success: false, message: "Invalid CSV header" });
    }
    let created = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const [code, name, description, icon, published, parent_code] = cols;
      if (!code || !name) continue;
      let parentId: number | null = null;
      if (parent_code) {
        const parent = await Category.findOne({ where: { code: parent_code } });
        parentId = (parent as any)?.id ?? null;
      }
      try {
        await Category.create({ code, name, description, icon, published: String(published).toLowerCase() === "true", parentId } as any);
        created++;
      } catch (_) {
        // ignore duplicates
      }
    }
    res.json({ data: { created } });
  } catch (err) {
    next(err);
  }
});

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        quoted = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export default router;

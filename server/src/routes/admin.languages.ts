import { Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const router = Router();

type LanguageRow = {
  id: number;
  name: string;
  isoCode: string;
  flag: string | null;
  published: number | boolean;
  createdAt: string;
  updatedAt: string;
};

type LanguageSeed = {
  name: string;
  isoCode: string;
  flag: string;
  published: boolean;
};

const DEFAULT_LANGUAGES: LanguageSeed[] = [
  { name: "English", isoCode: "en", flag: "US", published: true },
  { name: "Arabic", isoCode: "ar", flag: "SA", published: true },
  { name: "German", isoCode: "de", flag: "DE", published: true },
  { name: "French", isoCode: "fr", flag: "FR", published: true },
  { name: "Urdu", isoCode: "ur", flag: "PK", published: true },
  { name: "Bengali", isoCode: "bn", flag: "BD", published: true },
  { name: "Hindi", isoCode: "hi", flag: "IN", published: true },
  { name: "Indonesian", isoCode: "id", flag: "ID", published: true },
];

const hasOwn = (obj: any, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeIsoCode = (value: unknown) => normalizeText(value).toLowerCase();

const normalizeFlag = (value: unknown): string | null => {
  const text = normalizeText(value).toUpperCase();
  return text ? text : null;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const mapLanguageRow = (row: LanguageRow) => ({
  id: Number(row.id),
  name: String(row.name),
  isoCode: String(row.isoCode),
  flag: row.flag == null ? null : String(row.flag),
  published: Boolean(Number(row.published)),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const isDuplicateKeyError = (error: any): boolean => {
  const code = error?.original?.code || error?.parent?.code || error?.code;
  return code === "ER_DUP_ENTRY";
};

const ensureLanguagesTableAndDefaults = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS languages (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      isoCode VARCHAR(16) NOT NULL,
      flag VARCHAR(8) NULL,
      published TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_languages_isoCode (isoCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const countRows = (await sequelize.query(
    "SELECT COUNT(*) AS total FROM languages",
    { type: QueryTypes.SELECT }
  )) as Array<{ total: number | string }>;
  const total = Number(countRows[0]?.total || 0);

  if (total > 0) return;

  for (const language of DEFAULT_LANGUAGES) {
    await sequelize.query(
      `
        INSERT INTO languages (name, isoCode, flag, published, createdAt, updatedAt)
        VALUES (:name, :isoCode, :flag, :published, NOW(), NOW())
      `,
      {
        replacements: {
          name: language.name,
          isoCode: language.isoCode,
          flag: language.flag,
          published: language.published ? 1 : 0,
        },
      }
    );
  }
};

const getLanguageById = async (id: number) => {
  const rows = (await sequelize.query(
    `
      SELECT id, name, isoCode, flag, published, createdAt, updatedAt
      FROM languages
      WHERE id = :id
      LIMIT 1
    `,
    { type: QueryTypes.SELECT, replacements: { id } }
  )) as LanguageRow[];
  return rows[0] ? mapLanguageRow(rows[0]) : null;
};

// GET /api/admin/languages
router.get("/", async (req, res, next) => {
  try {
    await ensureLanguagesTableAndDefaults();
    const search = normalizeText(req.query?.search);

    let sql = `
      SELECT id, name, isoCode, flag, published, createdAt, updatedAt
      FROM languages
    `;
    const replacements: Record<string, string> = {};

    if (search) {
      sql += `
        WHERE name LIKE :search
          OR isoCode LIKE :search
          OR flag LIKE :search
      `;
      replacements.search = `%${search}%`;
    }

    sql += " ORDER BY name ASC, id ASC";

    const rows = (await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements,
    })) as LanguageRow[];

    return res.json({ success: true, data: rows.map(mapLanguageRow) });
  } catch (error) {
    return next(error);
  }
});

// POST /api/admin/languages
router.post("/", async (req, res, next) => {
  try {
    await ensureLanguagesTableAndDefaults();

    const name = normalizeText(req.body?.name);
    const isoCode = normalizeIsoCode(req.body?.isoCode);
    const flag = normalizeFlag(req.body?.flag);
    const published = toBoolean(req.body?.published, true);

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!isoCode) {
      return res
        .status(400)
        .json({ success: false, message: "isoCode is required" });
    }

    try {
      await sequelize.query(
        `
          INSERT INTO languages (name, isoCode, flag, published, createdAt, updatedAt)
          VALUES (:name, :isoCode, :flag, :published, NOW(), NOW())
        `,
        {
          replacements: {
            name,
            isoCode,
            flag,
            published: published ? 1 : 0,
          },
        }
      );

      const createdRows = (await sequelize.query(
        `
          SELECT id, name, isoCode, flag, published, createdAt, updatedAt
          FROM languages
          WHERE isoCode = :isoCode
          ORDER BY id DESC
          LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { isoCode } }
      )) as LanguageRow[];
      const created = createdRows[0] ? mapLanguageRow(createdRows[0]) : null;
      return res.status(201).json({ success: true, data: created });
    } catch (error: any) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({
          success: false,
          message: "Language with this isoCode already exists",
        });
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

// PUT /api/admin/languages/:id
router.put("/:id", async (req, res, next) => {
  try {
    await ensureLanguagesTableAndDefaults();

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const existing = await getLanguageById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Language not found" });
    }

    const body = req.body || {};
    const hasName = hasOwn(body, "name");
    const hasIsoCode = hasOwn(body, "isoCode");
    const hasFlag = hasOwn(body, "flag");
    const hasPublished = hasOwn(body, "published");

    if (!hasName && !hasIsoCode && !hasFlag && !hasPublished) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    const nextName = hasName ? normalizeText(body.name) : existing.name;
    const nextIsoCode = hasIsoCode
      ? normalizeIsoCode(body.isoCode)
      : existing.isoCode;
    const nextFlag = hasFlag ? normalizeFlag(body.flag) : existing.flag;
    const nextPublished = hasPublished
      ? toBoolean(body.published, existing.published)
      : existing.published;

    if (!nextName) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!nextIsoCode) {
      return res
        .status(400)
        .json({ success: false, message: "isoCode is required" });
    }

    try {
      await sequelize.query(
        `
          UPDATE languages
          SET
            name = :name,
            isoCode = :isoCode,
            flag = :flag,
            published = :published,
            updatedAt = NOW()
          WHERE id = :id
        `,
        {
          replacements: {
            id,
            name: nextName,
            isoCode: nextIsoCode,
            flag: nextFlag,
            published: nextPublished ? 1 : 0,
          },
        }
      );
    } catch (error: any) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({
          success: false,
          message: "Language with this isoCode already exists",
        });
      }
      throw error;
    }

    const updated = await getLanguageById(id);
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/admin/languages/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await ensureLanguagesTableAndDefaults();

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const [_rows, meta] = await sequelize.query(
      "DELETE FROM languages WHERE id = :id",
      { replacements: { id } }
    );

    const affected = Number((meta as any)?.affectedRows || 0);
    if (affected === 0) {
      return res.status(404).json({ success: false, message: "Language not found" });
    }

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

// POST /api/admin/languages/bulk-delete
router.post("/bulk-delete", async (req, res, next) => {
  try {
    await ensureLanguagesTableAndDefaults();

    const incoming = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = Array.from(
      new Set(
        incoming
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      )
    );

    if (ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "ids must be a non-empty array" });
    }

    const placeholders = ids.map(() => "?").join(", ");
    const [_rows, meta] = await sequelize.query(
      `DELETE FROM languages WHERE id IN (${placeholders})`,
      { replacements: ids }
    );
    const affected = Number((meta as any)?.affectedRows || 0);

    return res.json({ success: true, affected });
  } catch (error) {
    return next(error);
  }
});

export default router;

import { Router } from "express";
import multer from "multer";
import { Op } from "sequelize";
import { z } from "zod";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Order, User, UserAddress, sequelize } from "../models/index.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const ALLOWED_SORT = new Set(["createdAt", "name", "email", "status"]);
const CUSTOMER_MUTATION_STATUSES = [
  "active",
  "inactive",
  "blocked",
  "pending_verification",
] as const;
const customerMutationStatusSchema = z.enum(CUSTOMER_MUTATION_STATUSES);

const customerPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(160).optional(),
    phone: z.union([z.string().trim().max(40), z.null()]).optional(),
    status: customerMutationStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No customer fields submitted.",
  });

const importedCustomerRowSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(160).optional(),
    phone: z.union([z.string().trim().max(40), z.null()]).optional(),
    status: customerMutationStatusSchema.optional(),
  })
  .refine((value) => Boolean(value.id || value.email), {
    message: "Each customer row requires `id` or `email`.",
  });

const parseId = (value: string) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const normalizePhone = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const formatZodFieldErrors = (error: z.ZodError) =>
  error.issues.reduce<Record<string, string>>((acc, issue) => {
    const key = String(issue.path?.[0] || "form");
    if (!acc[key]) acc[key] = issue.message;
    return acc;
  }, {});

const toPlainCustomer = (customer: any) =>
  customer?.get ? customer.get({ plain: true }) : customer;

const toCustomerSummary = (customer: any, orderCount = 0) => {
  const plain = toPlainCustomer(customer) || {};
  return {
    id: Number(plain.id || 0) || null,
    name: plain.name || "",
    email: plain.email || "",
    phone: plain.phoneNumber ?? plain.phone_number ?? null,
    status: String(plain.status || "active").trim().toLowerCase(),
    createdAt: plain.createdAt ?? plain.created_at ?? null,
    updatedAt: plain.updatedAt ?? plain.updated_at ?? null,
    ordersCount: Number(orderCount || 0),
  };
};

const formatPrimaryAddress = (address: any) => {
  if (!address) return null;
  const plain = address?.get ? address.get({ plain: true }) : address;
  const parts = [
    plain?.streetName,
    plain?.houseNumber,
    plain?.building,
    plain?.district,
    plain?.city,
    plain?.province,
    plain?.postalCode,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const otherDetails = String(plain?.otherDetails ?? "").trim();
  if (otherDetails) parts.push(otherDetails);
  return parts.length ? parts.join(", ") : null;
};

const loadPrimaryAddressByUserId = async (userId: number) => {
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const address = await UserAddress.findOne({
    where: { userId } as any,
    order: [
      ["isPrimary", "DESC"],
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });
  return formatPrimaryAddress(address);
};

const loadOrderCounts = async (userIds: number[]) => {
  const normalizedIds = Array.from(
    new Set(
      userIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );

  if (!normalizedIds.length) return new Map<number, number>();

  const rows = await Order.findAll({
    attributes: [
      "userId",
      [sequelize.fn("COUNT", sequelize.col("id")), "orderCount"],
    ],
    where: { userId: { [Op.in]: normalizedIds } } as any,
    group: ["userId"],
    raw: true,
  });

  return new Map<number, number>(
    rows.map((row: any) => [
      Number(row.userId || 0),
      Number(row.orderCount || 0),
    ])
  );
};

const buildCustomerWhere = (query: Record<string, unknown>) => {
  const q = String(asSingle(query.q) ?? "").trim();
  const statusRaw = String(asSingle(query.status) ?? "").trim().toLowerCase();
  const where: any = { role: "customer" };

  if (q) {
    where[Op.or] = [
      { name: { [Op.like]: `%${q}%` } },
      { email: { [Op.like]: `%${q}%` } },
      { phoneNumber: { [Op.like]: `%${q}%` } },
    ];
  }

  if (
    CUSTOMER_MUTATION_STATUSES.includes(
      statusRaw as (typeof CUSTOMER_MUTATION_STATUSES)[number]
    )
  ) {
    where.status = statusRaw;
  }

  return { where, q, status: statusRaw || null };
};

const assertCustomerEmailAvailable = async (
  customerId: number,
  email: string | undefined
) => {
  if (!email) return;
  const existing = await User.findOne({
    where: {
      email,
      role: "customer",
      id: { [Op.ne]: customerId },
    } as any,
    attributes: ["id"],
  });
  if (existing) {
    const error = new Error("This email is unavailable.") as Error & {
      status?: number;
      fieldErrors?: Record<string, string>;
    };
    error.status = 409;
    error.fieldErrors = { email: "This email is unavailable." };
    throw error;
  }
};

const assertCustomerPhoneAvailable = async (
  customerId: number,
  phone: string | null | undefined
) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;
  const existing = await User.findOne({
    where: {
      phoneNumber: normalizedPhone,
      role: "customer",
      id: { [Op.ne]: customerId },
    } as any,
    attributes: ["id"],
  });
  if (existing) {
    const error = new Error("This phone number is unavailable.") as Error & {
      status?: number;
      fieldErrors?: Record<string, string>;
    };
    error.status = 409;
    error.fieldErrors = { phone: "This phone number is unavailable." };
    throw error;
  }
};

const buildCustomerPatch = (input: z.infer<typeof customerPatchSchema>) => {
  const patch: Record<string, unknown> = {};
  if (typeof input.name !== "undefined") patch.name = input.name;
  if (typeof input.email !== "undefined") patch.email = input.email;
  if (typeof input.phone !== "undefined") patch.phoneNumber = normalizePhone(input.phone);
  if (typeof input.status !== "undefined") patch.status = input.status;
  return patch;
};

// GET list dengan paginasi & search
router.get("/", requireStaffOrAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || req.query.pageSize || "10"), 10))
    );
    const sortRaw = String(req.query.sort || "createdAt");
    const sortKey = ALLOWED_SORT.has(sortRaw) ? sortRaw : "createdAt";
    const sortFieldMap: Record<string, string> = {
      createdAt: "created_at",
      name: "name",
      email: "email",
      status: "status",
    };
    const sortField = sortFieldMap[sortKey] || "created_at";
    const order =
      String(req.query.order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const { where } = buildCustomerWhere(req.query as Record<string, unknown>);

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: [
        "id",
        "name",
        "email",
        "phoneNumber",
        "status",
        "created_at",
        "updated_at",
      ],
      order: [[sortField, order]],
      limit,
      offset: (page - 1) * limit,
    });

    const orderCounts = await loadOrderCounts(
      rows.map((row: any) => Number(row?.id || 0))
    );

    res.json({
      data: rows.map((row: any) =>
        toCustomerSummary(row, orderCounts.get(Number(row?.id || 0)) || 0)
      ),
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/export", requireStaffOrAdmin, async (req, res, next) => {
  try {
    const { where, q, status } = buildCustomerWhere(req.query as Record<string, unknown>);
    const rows = await User.findAll({
      where,
      attributes: [
        "id",
        "name",
        "email",
        "phoneNumber",
        "status",
        "created_at",
        "updated_at",
      ],
      order: [["created_at", "DESC"]],
    });

    const orderCounts = await loadOrderCounts(
      rows.map((row: any) => Number(row?.id || 0))
    );
    const payload = {
      format: "admin-customers.v1",
      exportedAt: new Date().toISOString(),
      total: rows.length,
      filters: {
        q: q || null,
        status: status || null,
      },
      items: rows.map((row: any) =>
        toCustomerSummary(row, orderCounts.get(Number(row?.id || 0)) || 0)
      ),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="customers-export-${timestamp}.json"`
    );
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/import",
  requireAdmin,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const buf = req.file?.buffer;
      if (!buf) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded." });
      }

      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(buf.toString("utf8"));
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON file.",
        });
      }

      const items = Array.isArray(parsedPayload)
        ? parsedPayload
        : Array.isArray(parsedPayload?.items)
          ? parsedPayload.items
          : null;
      if (!items) {
        return res.status(400).json({
          success: false,
          message: "Import file must be a JSON array or an object with an `items` array.",
        });
      }

      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const errors: Array<{ row: number; id: number | null; email: string | null; message: string }> = [];

      for (let index = 0; index < items.length; index += 1) {
        const rawRow = items[index];

        try {
          const row = importedCustomerRowSchema.parse(rawRow);
          const existing = row.id
            ? await User.findOne({ where: { id: row.id, role: "customer" } as any })
            : await User.findOne({
                where: { email: row.email, role: "customer" } as any,
              });

          if (!existing) {
            throw new Error(
              row.id
                ? `Customer id ${row.id} was not found.`
                : "Customer email was not found."
            );
          }

          await assertCustomerEmailAvailable(Number((existing as any).id), row.email);
          await assertCustomerPhoneAvailable(
            Number((existing as any).id),
            typeof row.phone === "undefined" ? undefined : row.phone
          );

          const patch = buildCustomerPatch({
            name: row.name,
            email: row.email,
            phone: typeof row.phone === "undefined" ? undefined : row.phone,
            status: row.status,
          });

          if (Object.keys(patch).length === 0) {
            skipped += 1;
            continue;
          }

          await existing.update(patch as any);
          updated += 1;
        } catch (error: any) {
          failed += 1;
          errors.push({
            row: index + 1,
            id: Number(rawRow?.id || 0) || null,
            email:
              typeof rawRow?.email === "string" && rawRow.email.trim()
                ? rawRow.email.trim()
                : null,
            message:
              error instanceof z.ZodError
                ? Object.values(formatZodFieldErrors(error)).join(" ")
                : error?.fieldErrors
                  ? Object.values(error.fieldErrors).join(" ")
                  : error?.message || "Failed to import customer row.",
          });
        }
      }

      res.json({
        data: {
          updated,
          skipped,
          failed,
          errors,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET detail
router.get("/:id", requireStaffOrAdmin, async (req, res) => {
  const idNum = parseId(String(asSingle(req.params.id) ?? ""));
  if (!idNum) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const c = await User.findOne({
    where: { id: idNum, role: "customer" },
    attributes: [
      "id",
      "name",
      "email",
      "phoneNumber",
      "status",
      "created_at",
      "updated_at",
    ],
  });
  if (!c) return res.status(404).json({ success: false, message: "Not found" });

  const orderCounts = await loadOrderCounts([idNum]);
  const address = await loadPrimaryAddressByUserId(idNum);
  res.json({
    data: {
      ...toCustomerSummary(c, orderCounts.get(idNum) || 0),
      address,
      role: "customer",
    },
  });
});

// POST create
router.post("/", requireAdmin, async (_req, res) => {
  res.status(405).json({
    message: "Customer creation should be done via user registration.",
  });
});

// PUT update
router.put("/:id", requireAdmin, async (req, res) => {
  const idNum = parseId(String(asSingle(req.params.id) ?? ""));
  if (!idNum) return res.status(400).json({ message: "Invalid id" });

  let body: z.infer<typeof customerPatchSchema>;
  try {
    body = customerPatchSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Customer update payload is invalid.",
        errors: { fieldErrors: formatZodFieldErrors(error) },
      });
    }
    throw error;
  }

  const c = await User.findOne({
    where: { id: idNum, role: "customer" },
  });
  if (!c) return res.status(404).json({ message: "Customer not found" });

  try {
    await assertCustomerEmailAvailable(idNum, body.email);
    await assertCustomerPhoneAvailable(
      idNum,
      typeof body.phone === "undefined" ? undefined : body.phone
    );
  } catch (error: any) {
    return res.status(error?.status || 409).json({
      message: error?.message || "Customer contact is unavailable.",
      errors: {
        fieldErrors: error?.fieldErrors || undefined,
      },
    });
  }

  const patch = buildCustomerPatch(body);
  await c.update(patch as any);

  const orderCounts = await loadOrderCounts([idNum]);
  res.json({
    data: toCustomerSummary(c, orderCounts.get(idNum) || 0),
  });
});

// DELETE
router.delete("/:id", requireAdmin, async (req, res) => {
  const idNum = parseId(String(asSingle(req.params.id) ?? ""));
  if (!idNum) return res.status(400).json({ message: "Invalid id" });
  const c = await User.findOne({
    where: { id: idNum, role: "customer" },
  });
  if (!c) return res.status(404).json({ message: "Customer not found" });
  const orderCount = await Order.count({ where: { userId: idNum } as any });
  if (orderCount > 0) {
    return res.status(409).json({
      message:
        "Customer account already has orders. Disable the account instead of deleting it.",
    });
  }
  await c.destroy();
  res.json({ ok: true });
});

export default router;

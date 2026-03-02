import { Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const router = Router();

type CurrencyRow = {
  id: number;
  name: string;
  code: string;
  symbol: string;
  exchangeRate: string | number;
  published: number | boolean;
  createdAt: string;
  updatedAt: string;
};

type CurrencySeed = {
  name: string;
  code: string;
  symbol: string;
  exchangeRate: string;
  published: boolean;
};

const DEFAULT_CURRENCIES: CurrencySeed[] = [
  {
    name: "Indonesian Rupiah",
    code: "IDR",
    symbol: "Rp",
    exchangeRate: "1",
    published: true,
  },
  {
    name: "US Dollar",
    code: "USD",
    symbol: "$",
    exchangeRate: "0.000062",
    published: true,
  },
  {
    name: "Euro",
    code: "EUR",
    symbol: "€",
    exchangeRate: "0.000057",
    published: true,
  },
  {
    name: "British Pound",
    code: "GBP",
    symbol: "£",
    exchangeRate: "0.000049",
    published: true,
  },
  {
    name: "Singapore Dollar",
    code: "SGD",
    symbol: "S$",
    exchangeRate: "0.000084",
    published: true,
  },
];

const hasOwn = (obj: any, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeCode = (value: unknown) => normalizeText(value).toUpperCase();

const normalizeSymbol = (value: unknown) => normalizeText(value);

const normalizeExchangeRate = (value: unknown, fallback = "1"): string => {
  const text = normalizeText(value);
  if (!text) return fallback;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return String(parsed);
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

const mapCurrencyRow = (row: CurrencyRow) => ({
  id: Number(row.id),
  name: String(row.name),
  code: String(row.code).toUpperCase(),
  symbol: String(row.symbol),
  exchangeRate: String(row.exchangeRate ?? "1"),
  published: Boolean(Number(row.published)),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const isDuplicateKeyError = (error: any): boolean => {
  const code = error?.original?.code || error?.parent?.code || error?.code;
  return code === "ER_DUP_ENTRY";
};

const ensureCurrenciesTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS currencies (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      code VARCHAR(16) NOT NULL,
      symbol VARCHAR(16) NOT NULL,
      exchange_rate DECIMAL(18, 6) NOT NULL DEFAULT 1,
      published TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_currencies_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const ensureDefaultCurrencies = async () => {
  await ensureCurrenciesTable();
  for (const currency of DEFAULT_CURRENCIES) {
    await sequelize.query(
      `
        INSERT INTO currencies (name, code, symbol, exchange_rate, published, createdAt, updatedAt)
        VALUES (:name, :code, :symbol, :exchangeRate, :published, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          symbol = VALUES(symbol),
          exchange_rate = VALUES(exchange_rate),
          published = VALUES(published),
          updatedAt = VALUES(updatedAt)
      `,
      {
        replacements: {
          name: currency.name,
          code: currency.code,
          symbol: currency.symbol,
          exchangeRate: currency.exchangeRate,
          published: currency.published ? 1 : 0,
        },
      }
    );
  }
};

const getCurrencyById = async (id: number) => {
  const rows = (await sequelize.query(
    `
      SELECT id, name, code, symbol, exchange_rate AS exchangeRate, published, createdAt, updatedAt
      FROM currencies
      WHERE id = :id
      LIMIT 1
    `,
    { type: QueryTypes.SELECT, replacements: { id } }
  )) as CurrencyRow[];
  return rows[0] ? mapCurrencyRow(rows[0]) : null;
};

// GET /api/admin/currencies
router.get("/", async (req, res, next) => {
  try {
    await ensureDefaultCurrencies();
    const search = normalizeText(req.query?.search);

    let sql = `
      SELECT id, name, code, symbol, exchange_rate AS exchangeRate, published, createdAt, updatedAt
      FROM currencies
    `;
    const replacements: Record<string, string> = {};
    if (search) {
      sql += `
        WHERE name LIKE :search
          OR code LIKE :search
          OR symbol LIKE :search
      `;
      replacements.search = `%${search}%`;
    }
    sql += " ORDER BY name ASC, id ASC";

    const rows = (await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements,
    })) as CurrencyRow[];
    return res.json({ success: true, data: rows.map(mapCurrencyRow) });
  } catch (error) {
    return next(error);
  }
});

// POST /api/admin/currencies
router.post("/", async (req, res, next) => {
  try {
    await ensureDefaultCurrencies();

    const name = normalizeText(req.body?.name);
    const code = normalizeCode(req.body?.code);
    const symbol = normalizeSymbol(req.body?.symbol);
    const exchangeRate = normalizeExchangeRate(req.body?.exchangeRate, "1");
    const published = toBoolean(req.body?.published, true);

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!code) {
      return res.status(400).json({ success: false, message: "Code is required" });
    }
    if (!symbol) {
      return res.status(400).json({ success: false, message: "Symbol is required" });
    }

    try {
      await sequelize.query(
        `
          INSERT INTO currencies (name, code, symbol, exchange_rate, published, createdAt, updatedAt)
          VALUES (:name, :code, :symbol, :exchangeRate, :published, NOW(), NOW())
        `,
        {
          replacements: {
            name,
            code,
            symbol,
            exchangeRate,
            published: published ? 1 : 0,
          },
        }
      );

      const createdRows = (await sequelize.query(
        `
          SELECT id, name, code, symbol, exchange_rate AS exchangeRate, published, createdAt, updatedAt
          FROM currencies
          WHERE code = :code
          ORDER BY id DESC
          LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { code } }
      )) as CurrencyRow[];

      const created = createdRows[0] ? mapCurrencyRow(createdRows[0]) : null;
      return res.status(201).json({ success: true, data: created });
    } catch (error: any) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({
          success: false,
          message: "Currency with this code already exists",
        });
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

// PUT /api/admin/currencies/:id
router.put("/:id", async (req, res, next) => {
  try {
    await ensureDefaultCurrencies();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const existing = await getCurrencyById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Currency not found" });
    }

    const body = req.body || {};
    const hasName = hasOwn(body, "name");
    const hasCode = hasOwn(body, "code");
    const hasSymbol = hasOwn(body, "symbol");
    const hasExchangeRate = hasOwn(body, "exchangeRate");
    const hasPublished = hasOwn(body, "published");

    if (!hasName && !hasCode && !hasSymbol && !hasExchangeRate && !hasPublished) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    const nextName = hasName ? normalizeText(body.name) : existing.name;
    const nextCode = hasCode ? normalizeCode(body.code) : existing.code;
    const nextSymbol = hasSymbol ? normalizeSymbol(body.symbol) : existing.symbol;
    const nextExchangeRate = hasExchangeRate
      ? normalizeExchangeRate(body.exchangeRate, existing.exchangeRate)
      : existing.exchangeRate;
    const nextPublished = hasPublished
      ? toBoolean(body.published, existing.published)
      : existing.published;

    if (!nextName) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!nextCode) {
      return res.status(400).json({ success: false, message: "Code is required" });
    }
    if (!nextSymbol) {
      return res.status(400).json({ success: false, message: "Symbol is required" });
    }

    try {
      await sequelize.query(
        `
          UPDATE currencies
          SET
            name = :name,
            code = :code,
            symbol = :symbol,
            exchange_rate = :exchangeRate,
            published = :published,
            updatedAt = NOW()
          WHERE id = :id
        `,
        {
          replacements: {
            id,
            name: nextName,
            code: nextCode,
            symbol: nextSymbol,
            exchangeRate: nextExchangeRate,
            published: nextPublished ? 1 : 0,
          },
        }
      );
    } catch (error: any) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({
          success: false,
          message: "Currency with this code already exists",
        });
      }
      throw error;
    }

    const updated = await getCurrencyById(id);
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/admin/currencies/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await ensureDefaultCurrencies();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const [_rows, meta] = await sequelize.query(
      "DELETE FROM currencies WHERE id = :id",
      { replacements: { id } }
    );
    const affected = Number((meta as any)?.affectedRows || 0);
    if (affected === 0) {
      return res.status(404).json({ success: false, message: "Currency not found" });
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

// POST /api/admin/currencies/bulk-delete
router.post("/bulk-delete", async (req, res, next) => {
  try {
    await ensureDefaultCurrencies();
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
      `DELETE FROM currencies WHERE id IN (${placeholders})`,
      { replacements: ids }
    );
    const deleted = Number((meta as any)?.affectedRows || 0);
    return res.json({ success: true, deleted });
  } catch (error) {
    return next(error);
  }
});

export default router;

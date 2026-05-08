import { Op } from "sequelize";
import { Request, Response } from "express";
import { Product, Category } from "../../models/index.js";
import type { ProductAttributes } from "../../models/Product.js";

const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const toId = (v: unknown): number | null => {
  const raw = asSingle(v);
  const id = typeof raw === "string" ? Number(raw) : Number(raw as any);
  return Number.isFinite(id) ? id : null;
};

type ModelStatus = "active" | "inactive" | "draft";
const mapStatus: Record<string, ModelStatus> = {
  selling: "active",
  soldout: "inactive",
};

const toModelStatus = (raw?: string): ModelStatus | undefined => {
  if (!raw) return undefined;
  const key = raw.toLowerCase();
  if (key in mapStatus) return mapStatus[key];
  if (["active", "inactive", "draft"].includes(key)) return key as ModelStatus;
  return undefined;
};
import {
  ProductQuerySchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  TogglePublishSchema,
} from "../../schemas/catalog.js";
import type { WhereOptions } from "sequelize";

export async function listProducts(req: Request, res: Response) {
  const qp = ProductQuerySchema.parse(req.query);
  const qStatus =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const status = toModelStatus(qStatus);
  const where: Partial<ProductAttributes> = {};
  if (qp.q) where.name = { [Op.like]: `%${qp.q}%` } as any;
  if (qp.categoryId) where.categoryId = qp.categoryId;
  if (status) where.status = status;

  const offset = (qp.page - 1) * qp.pageSize;
  const { rows, count } = await Product.findAndCountAll({
    where,
    include: [{ model: Category, as: "category", attributes: ["id", "name"] }],
    limit: qp.pageSize,
    offset,
    order: [[qp.sort, qp.order.toUpperCase() as any]],
  });

  return res.json({
    items: rows.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category?.name ?? "-",
      price: p.price,
      salePrice: p.salePrice,
      stock: p.stock,
      status: p.status,
      isPublished: p.isPublished,
      sku: p.sku,
    })),
    page: qp.page,
    pageSize: qp.pageSize,
    total: count,
  });
}

export async function getProduct(req: Request, res: Response) {
  const id = toId(req.params.id);
  if (id === null) return res.status(400).json({ message: "Invalid id" });
  const p = await Product.findByPk(id, {
    include: [{ model: Category, as: "category" }],
  });
  if (!p) return res.status(404).json({ message: "Not found" });
  return res.json(p);
}

export async function createProduct(req: Request, res: Response) {
  const body = ProductCreateSchema.parse(req.body);
  // whitelist known fields from the incoming body
  const {
    name,
    price,
    categoryId,
    description,
    stock,
    images,
    status: rawStatus,
  } = body as any;
  const newProduct: Partial<ProductAttributes> = {
    name,
    slug: (name || "").toLowerCase().replace(/\s+/g, "-"),
    price,
    categoryId,
    description,
    stock,
    // images field may map to imagePaths in model — keep as-is if model supports it
    // map status to model enum
    status: toModelStatus(rawStatus) ?? "draft",
  };

  const p = await Product.create(newProduct as any);
  res.status(201).json(p);
}

export async function updateProduct(req: Request, res: Response) {
  const body = ProductUpdateSchema.parse(req.body);
  const id = toId(req.params.id);
  if (id === null) return res.status(400).json({ message: "Invalid id" });
  const p = await Product.findByPk(id);
  if (!p) return res.status(404).json({ message: "Not found" });
  // whitelist update fields
  const {
    name,
    price,
    categoryId,
    description,
    stock,
    status: rawStatus,
  } = body as any;
  const updatePayload: Partial<ProductAttributes> = {};
  if (name !== undefined) updatePayload.name = name;
  if (price !== undefined) updatePayload.price = price;
  if (categoryId !== undefined) updatePayload.categoryId = categoryId;
  if (description !== undefined) updatePayload.description = description;
  if (stock !== undefined) updatePayload.stock = stock;
  if (rawStatus !== undefined)
    updatePayload.status = toModelStatus(rawStatus) ?? updatePayload.status;
  await p.update(updatePayload as any);
  res.json(p);
}

export async function deleteProduct(req: Request, res: Response) {
  const id = toId(req.params.id);
  if (id === null) return res.status(400).json({ message: "Invalid id" });
  const p = await Product.findByPk(id);
  if (!p) return res.status(404).json({ message: "Not found" });
  await p.destroy();
  res.status(204).end();
}

export async function togglePublish(req: Request, res: Response) {
  const { published } = TogglePublishSchema.parse(req.body);
  const id = toId(req.params.id);
  if (id === null) return res.status(400).json({ message: "Invalid id" });
  const p = await Product.findByPk(id);
  if (!p) return res.status(404).json({ message: "Not found" });
  await p.update({ isPublished: published } as any);
  res.json({ id: p.id, isPublished: p.isPublished });
}

export async function changeStatus(req: Request, res: Response) {
  const { status } = req.body as { status: "selling" | "soldout" | "draft" };
  const id = toId(req.params.id);
  if (id === null) return res.status(400).json({ message: "Invalid id" });
  const p = await Product.findByPk(id);
  if (!p) return res.status(404).json({ message: "Not found" });
  const normalized = toModelStatus(status);
  if (!normalized)
    return res.status(400).json({ message: `Invalid status value: ${status}` });
  await p.update({ status: normalized } as any);
  res.json({ id: p.id, status: p.status });
}


// server/src/controllers/product.controller.ts
import { Request, Response } from "express";
import { Product } from "../models/index.js";

export async function listProducts(req: Request, res: Response) {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const where: any = {};
  if (req.query.status) where.status = String(req.query.status);

  const { rows, count } = await Product.findAndCountAll({
    where,
    limit,
    offset,
    order: [["id", "DESC"]],
  });

  res.json({ items: rows, total: count });
}

export async function createProduct(req: Request, res: Response) {
  const {
    name,
    slug,
    sku = null,
    price = 0,
    stock = 0,
    status = "active",
  } = req.body || {};
  if (!name) return res.status(400).json({ message: "name is required" });
  const created = await Product.create({
    name,
    slug: (slug ?? name).toLowerCase().replace(/\s+/g, "-"),
    sku,
    price,
    stock,
    status,
    userId: (req as any).user?.id ?? 0,
    isPublished: false,
  } as any);
  res.status(201).json(created);
}

export async function getProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  const item = await Product.findByPk(id);
  if (!item) return res.status(404).json({ message: "Not found" });
  res.json(item);
}

export async function updateProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  const item = await Product.findByPk(id);
  if (!item) return res.status(404).json({ message: "Not found" });

  const { name, sku, price, stock, status } = req.body || {};
  const updatePayload: any = {};
  if (name !== undefined) updatePayload.name = name;
  if (sku !== undefined) updatePayload.sku = sku;
  if (price !== undefined) updatePayload.price = price;
  if (stock !== undefined) updatePayload.stock = stock;
  if (status !== undefined) updatePayload.status = status;
  await item.update(updatePayload as any);
  res.json(item);
}

export async function deleteProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  const item = await Product.findByPk(id);
  if (!item) return res.status(404).json({ message: "Not found" });

  await item.destroy();
  res.json({ message: "deleted" });
}



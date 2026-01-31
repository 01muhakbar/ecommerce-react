import express from "express";
import { Category } from '../models/Category.js';

const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const toId = (v: unknown): number | null => {
  const raw = asSingle(v);
  const id = typeof raw === "string" ? Number(raw) : Number(raw as any);
  return Number.isFinite(id) ? id : null;
};

export const createCategory = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const { description }: { name: string; description?: string } = req.body;
    const name = String(req.body.name ?? "").trim();
    if (!name) {
      res.status(400).json({
        status: "fail",
        message: "Category name is required.",
      });
      return;
    }

    const code =
      name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 40) || `cat-${Date.now()}`;
    const newCategory = await Category.create({
      name,
      description,
      code,
      published: true,
    } as any);

    res.status(201).json({
      status: "success",
      data: {
        category: newCategory,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error creating category.",
      error: (error as Error).message,
    });
  }
};

export const getAllCategories = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const categories = await Category.findAll();

    res.status(200).json({
      status: "success",
      results: categories.length,
      data: {
        categories,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching categories.",
      error: (error as Error).message,
    });
  }
};

export const getCategoryById = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const id = toId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }
    const category = await Category.findByPk(id);

    if (!category) {
      res.status(404).json({
        status: "fail",
        message: "Category not found.",
      });
      return;
    }

    res.status(200).json({ status: "success", data: { category } });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching category.",
      error: (error as Error).message,
    });
  }
};

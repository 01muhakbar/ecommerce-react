import { Request, Response } from 'express';
import db from '../models/index';

const { Category } = db;

// [REFACTORED] Menggantikan renderManageCategoriesPage
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.findAll();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: (error as Error).message });
  }
};

// [REFACTORED] Menggantikan addCategory
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ message: 'Nama kategori tidak boleh kosong' });
      return;
    }
    const newCategory = await Category.create({ name });
    res.status(201).json({ message: 'Kategori berhasil ditambahkan', category: newCategory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: (error as Error).message });
  }
};

// [REFACTORED] Menggantikan renderEditCategoryPage
export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      res.status(404).send('Kategori tidak ditemukan');
      return;
    }
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: (error as Error).message });
  }
};

// [REFACTORED] Menggantikan editCategory
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      res.status(404).json({ message: 'Kategori tidak ditemukan' });
      return;
    }
    if (!name) {
      res.status(400).json({ message: 'Nama kategori tidak boleh kosong' });
      return;
    }
    await category.update({ name });
    res.status(200).json({ message: 'Kategori berhasil diperbarui', category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: (error as Error).message });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      res.status(404).json({ message: 'Kategori tidak ditemukan' });
      return;
    }
    await category.destroy();
    res.status(200).json({ message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: (error as Error).message });
  }
};

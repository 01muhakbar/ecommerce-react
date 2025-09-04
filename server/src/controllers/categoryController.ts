import { Request, Response } from 'express';
import db from '../models/index';

const { Category } = db;

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description }: { name: string; description?: string } = req.body;
    if (!name) {
      res.status(400).json({
        status: 'fail',
        message: 'Category name is required.',
      });
      return;
    }

    const newCategory = await Category.create({ name, description });
    
    res.status(201).json({
      status: 'success',
      data: {
        category: newCategory,
      },
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error creating category.',
      error: (error as Error).message,
    });
  }
};

export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.findAll();
    
    res.status(200).json({
      status: 'success',
      results: categories.length,
      data: {
        categories,
      },
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching categories.',
      error: (error as Error).message,
    });
  }
};

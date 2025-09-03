import express, { Router } from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware';
import * as categoryController from '../controllers/categoryController';

const router: Router = express.Router();

// Rute untuk membuat kategori baru (hanya admin)
router.post('/', protect, restrictTo('admin'), categoryController.createCategory);

// Rute untuk mendapatkan semua kategori (hanya admin)
router.get('/', protect, restrictTo('admin'), categoryController.getAllCategories);

export default router;
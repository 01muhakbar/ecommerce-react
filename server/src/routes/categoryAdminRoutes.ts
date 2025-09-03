import express, { Router } from 'express';
import * as categoryAdminController from '../controllers/categoryAdminController';
import { protect, restrictTo } from '../middleware/authMiddleware';

const router: Router = express.Router();

// Middleware untuk melindungi semua rute di file ini (hanya untuk admin)
router.use(protect, restrictTo('admin'));

// Mendapatkan semua kategori & membuat kategori baru
router
  .route('/')
  .get(categoryAdminController.getAllCategories)
  .post(categoryAdminController.createCategory);

// Mendapatkan, memperbarui, dan menghapus kategori berdasarkan ID
router
  .route('/:id')
  .get(categoryAdminController.getCategoryById)
  .put(categoryAdminController.updateCategory)
  .delete(categoryAdminController.deleteCategory);

export default router;
const express = require('express');
const router = express.Router();
const categoryAdminController = require('../controllers/categoryAdminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Middleware to protect all routes in this file
router.use(protect, restrictTo('admin'));

// Routes for category management
router.get('/categories', categoryAdminController.renderManageCategoriesPage);
router.get('/categories/add', categoryAdminController.renderAddCategoryPage);
router.post('/categories', categoryAdminController.addCategory);
router.get('/categories/:id/edit', categoryAdminController.renderEditCategoryPage);
router.put('/categories/:id', categoryAdminController.editCategory);
router.delete('/categories/:id', categoryAdminController.deleteCategory);

module.exports = router;

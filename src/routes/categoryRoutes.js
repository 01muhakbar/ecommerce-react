const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const categoryController = require('../controllers/categoryController');

router.post('/', protect, restrictTo('admin'), categoryController.createCategory);
router.get('/', protect, restrictTo('admin'), categoryController.getAllCategories);

module.exports = router;

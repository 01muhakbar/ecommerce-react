const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const productController = require('../controllers/productController');

// All routes in this file are protected and restricted to sellers
router.use(protect, restrictTo('penjual'));

// View all products for the seller
router.get('/products', productController.getSellerProducts);

// Show the page to edit a product
router.get('/products/:id/edit', productController.getEditProductPage);

// Handle the update of a product
router.post('/products/:id/edit', productController.updateProduct);

// Handle the deletion of a product
router.post('/products/:id/delete', productController.deleteProduct);

module.exports = router;
// src/controllers/productController.js

const db = require("../models");

// Fungsi baru untuk merender halaman produk
exports.renderAllProducts = async (req, res) => {
  try {
    const products = await db.Product.findAll({
      order: [['createdAt', 'DESC']], // Urutkan berdasarkan terbaru
    });
    // Render view EJS dan kirim data produk
    res.render("products", {
      products: products,
      isLoggedIn: req.cookies.token ? true : false, // Cek jika pengguna login
      messages: {}, // Untuk pesan flash (jika ada)
    });
  } catch (error) {
    // Handle error, mungkin render halaman error
    res.status(500).send("<h1>Error memuat halaman produk</h1><p>" + error.message + "</p>");
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;
    const userId = req.user.id; // Get user ID from authenticated user

    // Validasi dasar
    if (!name || !price || stock === undefined) {
      return res
        .status(400)
        .json({ message: "Name, price, and stock are required." });
    }

    const newProduct = await db.Product.create({
      name,
      description,
      price,
      stock,
      userId, // Associate product with the user
    });

    res
      .status(201)
      .json({ message: "Product created successfully", product: newProduct });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create product", error: error.message });
  }
};

// Fungsi untuk mengambil semua produk
exports.getAllProducts = async (req, res) => {
  try {
    const products = await db.Product.findAll();
    res.status(200).json(products);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch products", error: error.message });
  }
};

// Fungsi untuk mengambil detail satu produk berdasarkan ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await db.Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch product details",
      error: error.message,
    });
  }
};

// Get all products for the logged-in seller
exports.getSellerProducts = async (req, res) => {
  try {
    const products = await db.Product.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.render('seller/products', {
      products,
      isLoggedIn: true,
      user: req.user, // Pass the user object
      messages: {},
    });
  } catch (error) {
    res.status(500).send("Error loading products: " + error.message);
  }
};

// Show the edit product page
exports.getEditProductPage = async (req, res) => {
  try {
    const product = await db.Product.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!product) {
      return res.status(404).send("Product not found or you don't have permission to edit it.");
    }
    res.render('seller/edit-product', {
      product,
      isLoggedIn: true,
      messages: {},
    });
  } catch (error) {
    res.status(500).send("Error loading product for editing: " + error.message);
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;
    const product = await db.Product.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!product) {
      return res.status(404).send("Product not found or you don't have permission to edit it.");
    }

    await product.update({ name, description, price, stock });
    res.redirect('/dashboard/seller/products');
  } catch (error) {
    res.status(500).send("Error updating product: " + error.message);
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await db.Product.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!product) {
      return res.status(404).send("Product not found or you don't have permission to delete it.");
    }

    await product.destroy();
    res.redirect('/dashboard/seller/products');
  } catch (error) {
    res.status(500).send("Error deleting product: " + error.message);
  }
};

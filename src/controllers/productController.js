// src/controllers/productController.js

const db = require("../models");
const { Op } = require('sequelize');

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
    const { name, description, price, stock, categoryId } = req.body;
    const userId = req.user.id; // Get user ID from authenticated user

    console.log("--- createProduct Debug ---");
    console.log("Received req.body:", req.body);
    console.log("Extracted userId:", userId);
    console.log("Extracted categoryId:", categoryId);

    // Validasi dasar
    if (!name || !price || stock === undefined) {
      console.log("Validation failed: Name, price, or stock missing.");
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
      categoryId,
    });

    console.log("Product created successfully:", newProduct.toJSON());

    res
      .status(201)
      .json({ message: "Product created successfully", product: newProduct });
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error); // More detailed error logging
    res
      .status(500)
      .json({ message: "Failed to create product", error: error.message });
  }
};

// Fungsi untuk mengambil semua produk
exports.getAllProducts = async (req, res) => {
  try {
    let where = {};
    const { categoryId, userId, search } = req.query; // Destructure search

    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (userId) { // This is the seller filter
      where.userId = userId;
    }
    if (search) { // New search condition
      where.name = { [Op.like]: `%${search}%` };
    }

    console.log("--- getAllProducts Debug ---");
    console.log("Received query parameters:", req.query);
    console.log("Constructed where clause:", where);

    const products = await db.Product.findAll({
      where,
      include: [
        { model: db.User, as: 'seller', attributes: ['name'] },
        { model: db.Category, as: 'category', attributes: ['name'] }
      ],
    });

    console.log("Number of products found:", products.length);

    res.status(200).json({
      status: "success",
      results: products.length,
      data: {
        products: products,
      },
    });
  } catch (error) {
    console.error("GET ALL PRODUCTS ERROR:", error); // More detailed error logging
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

// Show the admin edit product page
exports.renderAdminEditProductPage = async (req, res) => {
  try {
    const product = await db.Product.findByPk(req.params.id, {
      include: [{ model: db.Category, as: 'category' }]
    });
    const categories = await db.Category.findAll();
    if (!product) {
      return res.status(404).send("Product not found.");
    }
    res.render('admin/edit-product', {
      product,
      categories,
      isLoggedIn: true, // Assuming admin is logged in
      user: req.user, // Add this line
      messages: {},
    });
  } catch (error) {
    res.status(500).send("Error loading product for editing: " + error.message);
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, categoryId } = req.body;

    const product = await db.Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    await product.update({ name, description, price, stock, categoryId });
    res.status(200).json({ message: "Product updated successfully.", product });
  } catch (error) {
    res.status(500).json({ message: "Failed to update product", error: error.message });
  }
};


// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await db.Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    await product.destroy();
    res.status(204).json({ message: "Product deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
};

exports.renderAdminProductsPage = async (req, res) => {
  try {
    const categories = await db.Category.findAll();
    const sellers = await db.User.findAll({
      where: { role: 'penjual' },
      attributes: ['id', 'name']
    });
    res.render('admin/products', {
      categories,
      sellers,
      isLoggedIn: true,
      user: req.user,
      messages: {},
    });
  } catch (error) {
    res.status(500).send("Error loading page: " + error.message);
  }
};

exports.renderAddProductPageAdmin = async (req, res) => {
  try {
    const categories = await db.Category.findAll();
    res.render("add-new-product", {
      user: req.user,
      isLoggedIn: true,
      categories: categories,
      messages: {},
    });
  } catch (error) {
    res.status(500).send("<h1>Error loading page</h1><p>" + error.message + "</p>");
  }
};

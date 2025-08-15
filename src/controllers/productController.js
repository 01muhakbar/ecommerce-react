// src/controllers/productController.js

const db = require("../models");

exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;

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

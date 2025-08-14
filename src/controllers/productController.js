// src/controllers/productController.js
const Product = require("../models/Product");

// CREATE: Membuat produk baru dari form
const createProduct = async (req, res) => {
  try {
    await Product.create(req.body);
    // Alihkan pengguna kembali ke halaman daftar produk setelah berhasil
    return res.redirect("/products");
  } catch (error) {
    console.error("TERJADI ERROR SAAT MEMBUAT PRODUK:", error);
    return res.status(500).send("Terjadi kesalahan saat menyimpan produk.");
  }
};

// READ: Menampilkan semua produk ke halaman web
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll();
    return res.render("products", {
      products: products,
    });
  } catch (error) {
    console.error("Error saat mengambil produk:", error);
    return res.status(500).send("Gagal memuat halaman produk.");
  }
};

// READ: Menampilkan detail satu produk ke halaman web
const getProductById = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).send("Produk tidak ditemukan");
    }
    return res.render("product-detail", {
      product: product,
    });
  } catch (error) {
    console.error("Error saat mengambil detail produk:", error);
    return res.status(500).send("Gagal memuat halaman detail produk.");
  }
};

// UPDATE: Memperbarui produk (Form handler)
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).send("Produk tidak ditemukan");
    }
    await product.update(req.body);
    return res.redirect(`/products/${req.params.id}`);
  } catch (error) {
    return res.status(500).send("Gagal memperbarui produk.");
  }
};

// DELETE: Menghapus produk (Form handler)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).send("Produk tidak ditemukan");
    }
    await product.destroy();
    return res.redirect("/products");
  } catch (error) {
    return res.status(500).send("Gagal menghapus produk.");
  }
};

// RENDER FORM: Menampilkan form tambah produk
const showAddForm = (req, res) => {
  return res.render("add-product");
};

// RENDER FORM: Menampilkan form edit produk
const showEditForm = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).send("Produk tidak ditemukan");
    }
    return res.render("edit-product", {
      product: product,
    });
  } catch (error) {
    return res.status(500).send("Gagal memuat form edit.");
  }
};

// Ekspor semua fungsi yang akan digunakan oleh rute
module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  showAddForm,
  showEditForm, // Pastikan semua fungsi yang Anda gunakan ada di sini
};

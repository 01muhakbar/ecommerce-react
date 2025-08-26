const db = require("../models");
const { Op } = require('sequelize');

// Fungsi untuk membuat produk baru
exports.createProduct = async (req, res) => {
  try {
    // 1. Ambil data teks dari req.body
    const {
      name,
      description,
      price,
      stock,
      categoryId,
      status, // Field baru
      gtin,
      notes,
      parentSku,
      condition,
      weight,
      length,
      width,
      height,
      dangerousProduct,
      preOrder,
      preorderDays,
      youtubeLink,
      variations, // Ini akan berupa JSON string
      wholesale, // Ini juga JSON string
    } = req.body;

    const userId = req.user.id; // Ambil ID pengguna dari middleware otentikasi

    // 2. Ambil path file dari req.files (disediakan oleh multer)
    let promoImagePath = null;
    if (req.files && req.files.promoProductImage) {
      promoImagePath = req.files.promoProductImage[0].path;
    }

    let imagePaths = [];
    if (req.files && req.files.productImages) {
      imagePaths = req.files.productImages.map(file => file.path);
    }

    let videoPath = null;
    if (req.files && req.files.productVideo) {
      videoPath = req.files.productVideo[0].path;
    }

    // 3. Validasi dasar (bisa diperkuat sesuai kebutuhan)
    if (!name || !price || !stock || !weight) {
      return res.status(400).json({ 
        success: false, 
        message: "Nama, harga, stok, dan berat produk wajib diisi."
      });
    }

    // 4. Buat produk di database dengan semua data yang sudah diproses
    const newProduct = await db.Product.create({
      name,
      description,
      price: parseFloat(price),
      stock: parseInt(stock, 10),
      categoryId,
      userId,
      status: status || 'archived', // Default ke 'archived' jika tidak ada status
      
      // Tambahkan field-field baru di sini
      // PASTIKAN NAMA-NAMA INI SESUAI DENGAN KOLOM DI DATABASE ANDA
      gtin,
      notes,
      parentSku,
      condition,
      weight: parseInt(weight, 10),
      length: length ? parseInt(length, 10) : null,
      width: width ? parseInt(width, 10) : null,
      height: height ? parseInt(height, 10) : null,
      dangerousProduct: dangerousProduct === 'true',
      preOrder: preOrder === 'true',
      preorderDays: preOrder === 'true' ? parseInt(preorderDays, 10) : null,
      youtubeLink,
      
      // Simpan path file
      promoImagePath: promoImagePath, // Path untuk gambar promosi
      imagePaths: imagePaths,       // Array path untuk gambar produk
      videoPath: videoPath,           // Path untuk video produk

      // Simpan data JSON (pastikan tipe data di DB adalah JSON atau TEXT)
      variations: variations ? JSON.parse(variations) : null,
      wholesale: wholesale ? JSON.parse(wholesale) : null,
    });

    res.status(201).json({ 
      success: true, 
      message: "Produk berhasil dibuat!", 
      product: newProduct 
    });

  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error); 
    res.status(500).json({ 
      success: false, 
      message: "Gagal membuat produk", 
      error: error.message 
    });
  }
};

// ... (sisa fungsi controller lainnya tidak diubah)

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

    const products = await db.Product.findAll({
      where,
      include: [
        { model: db.User, as: 'seller', attributes: ['name'] },
        { model: db.Category, as: 'category', attributes: ['name'] }
      ],
    });

    res.status(200).json({
      status: "success",
      results: products.length,
      data: {
        products: products,
      },
    });
  } catch (error) {
    console.error("GET ALL PRODUCTS ERROR:", error);
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

// ... (Menyisakan fungsi renderAllProducts yang mungkin masih digunakan di tempat lain)
exports.renderAllProducts = async (req, res) => {
  try {
    const products = await db.Product.findAll({
      order: [['createdAt', 'DESC']],
    });
    res.render("products", {
      products: products,
      isLoggedIn: req.cookies.token ? true : false,
      messages: {}, 
    });
  } catch (error) {
    res.status(500).send("<h1>Error memuat halaman produk</h1><p>" + error.message + "</p>");
  }
};
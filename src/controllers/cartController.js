// src/controllers/cartController.js
const Product = require("../models/Product");

exports.addToCart = async (req, res) => {
  const productId = req.params.id;

  try {
    // 1. Inisialisasi keranjang di session jika belum ada
    if (!req.session.cart) {
      req.session.cart = [];
    }
    const cart = req.session.cart;

    // 2. Cari produk di database untuk mendapatkan detailnya
    const product = await Product.findByPk(productId);
    if (!product) {
      req.flash("error", "Produk tidak ditemukan.");
      return res.redirect("/products");
    }

    // 3. Cek apakah produk sudah ada di keranjang
    const existingProductIndex = cart.findIndex(
      (item) => item.id === productId
    );

    if (existingProductIndex > -1) {
      // Jika sudah ada, tambah jumlahnya (quantity)
      cart[existingProductIndex].quantity += 1;
    } else {
      // Jika belum ada, tambahkan produk baru ke keranjang
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
      });
    }

    req.flash("success", `${product.name} telah ditambahkan ke keranjang!`);
    res.redirect("/products");
  } catch (error) {
    console.error(error);
    req.flash("error", "Gagal menambahkan produk ke keranjang.");
    res.redirect("/products");
  }
};

exports.showCart = (req, res) => {
  // Ambil keranjang dari sesi, atau array kosong jika tidak ada
  const cart = req.session.cart || [];

  // Hitung total harga
  const totalPrice = cart.reduce((total, item) => {
    return total + item.quantity * item.price;
  }, 0);

  res.render("cart", {
    cartItems: cart,
    totalPrice: totalPrice,
    messages: req.flash(), // Kirim pesan flash ke view
  });
};

exports.removeFromCart = (req, res) => {
  const productId = req.params.id;
  let cart = req.session.cart || [];

  // Filter keranjang untuk menghapus item dengan ID yang cocok
  cart = cart.filter((item) => item.id !== productId);
  req.session.cart = cart;

  req.flash("success", "Produk telah dihapus dari keranjang.");
  res.redirect("/cart");
};

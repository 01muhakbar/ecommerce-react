// src/controllers/cartController.js

const db = require("../models");

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body; // Default quantity to 1 if not provided
    const userId = req.user.id; // Diambil dari token JWT oleh middleware isAuth

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required." });
    }

    // 1. Cari atau buat keranjang untuk user
    const [cart] = await db.Cart.findOrCreate({
      where: { userId },
      defaults: { userId },
    });

    // 2. Cek apakah item sudah ada di keranjang
    const [cartItem, itemCreated] = await db.CartItem.findOrCreate({
      where: { cartId: cart.id, productId: productId },
      defaults: { quantity: quantity },
    });

    // 3. Jika item sudah ada, tambahkan quantity-nya
    if (!itemCreated) {
      cartItem.quantity += quantity;
      await cartItem.save();
    }

    res.status(200).json({
      message: "Product added to cart successfully.",
      cartItem,
    });
  } catch (error) {
    console.error("ADD TO CART ERROR:", error);
    res.status(500).json({
      message: "Failed to add product to cart.",
      error: error.message,
    });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // Cari keranjang user dan sertakan produk-produk di dalamnya
    const cart = await db.Cart.findOne({
      where: { userId },
      include: [
        {
          model: db.Product,
          // Melalui tabel perantara, kita juga bisa mengambil atribut 'quantity'
          through: { attributes: ["quantity"] },
        },
      ],
    });

    if (!cart) {
      // Jika user belum memiliki keranjang, kirim struktur keranjang kosong
      return res.status(200).json({ id: null, userId, Products: [] });
    }

    res.status(200).json(cart);
  } catch (error) {
    console.error("GET CART ERROR:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch cart.", error: error.message });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // 1. Temukan keranjang pengguna
    const cart = await db.Cart.findOne({ where: { userId } });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    // 2. Hapus item dari tabel CartItem
    const deletedRows = await db.CartItem.destroy({
      where: {
        cartId: cart.id,
        productId: productId,
      },
    });

    if (deletedRows === 0) {
      return res.status(404).json({ message: "Item not found in cart." });
    }

    res.status(200).json({ message: "Item removed from cart successfully." });
  } catch (error) {
    console.error("REMOVE FROM CART ERROR:", error);
    res.status(500).json({
      message: "Failed to remove item from cart.",
      error: error.message,
    });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { quantity } = req.body;

    // Validasi input kuantitas
    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ message: "Invalid quantity provided." });
    }

    const cart = await db.Cart.findOne({ where: { userId } });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    // Jika kuantitas 0, hapus item dari keranjang
    if (quantity === 0) {
      await db.CartItem.destroy({
        where: { cartId: cart.id, productId: productId },
      });
      return res.status(200).json({ message: "Item removed from cart." });
    }

    // Periksa stok produk sebelum memperbarui
    const product = await db.Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }
    if (product.stock < quantity) {
      return res.status(400).json({
        message: `Not enough stock. Only ${product.stock} items available.`,
      });
    }

    // Perbarui kuantitas item di keranjang
    await db.CartItem.update(
      { quantity },
      { where: { cartId: cart.id, productId: productId } }
    );

    res.status(200).json({ message: "Cart updated successfully." });
  } catch (error) {
    console.error("UPDATE CART ERROR:", error);
    res
      .status(500)
      .json({ message: "Failed to update cart.", error: error.message });
  }
};

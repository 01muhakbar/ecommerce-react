"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCartItem = exports.removeFromCart = exports.getCart = exports.addToCart = void 0;
const index_1 = require("../models/index");
// --- CONTROLLER FUNCTIONS ---
const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (!productId) {
            res.status(400).json({ message: "Product ID is required." });
            return;
        }
        const [cart] = await index_1.Cart.findOrCreate({
            where: { userId },
            defaults: { userId },
        });
        const [cartItem, itemCreated] = await index_1.CartItem.findOrCreate({
            where: { cartId: cart.id, productId: productId },
            defaults: { quantity: quantity, productId: productId, cartId: cart.id },
        });
        if (!itemCreated) {
            cartItem.quantity += quantity;
            await cartItem.save();
        }
        res.status(200).json({ message: "Product added to cart successfully.", cartItem });
    }
    catch (error) {
        console.error("ADD TO CART ERROR:", error);
        res.status(500).json({ message: "Failed to add product to cart.", error: error.message });
    }
};
exports.addToCart = addToCart;
const getCart = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const cart = await index_1.Cart.findOne({
            where: { userId },
            include: [{
                    model: index_1.Product,
                    through: { attributes: ["quantity"] },
                }],
        });
        if (!cart) {
            res.status(200).json({ id: null, userId, Products: [] });
            return;
        }
        res.status(200).json(cart);
    }
    catch (error) {
        console.error("GET CART ERROR:", error);
        res.status(500).json({ message: "Failed to fetch cart.", error: error.message });
    }
};
exports.getCart = getCart;
const removeFromCart = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { productId } = req.params;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const cart = await index_1.Cart.findOne({ where: { userId } });
        if (!cart) {
            res.status(404).json({ message: "Cart not found." });
            return;
        }
        const deletedRows = await index_1.CartItem.destroy({
            where: {
                cartId: cart.id,
                productId: Number(productId),
            },
        });
        if (deletedRows === 0) {
            res.status(404).json({ message: "Item not found in cart." });
            return;
        }
        res.status(200).json({ message: "Item removed from cart successfully." });
    }
    catch (error) {
        console.error("REMOVE FROM CART ERROR:", error);
        res.status(500).json({ message: "Failed to remove item from cart.", error: error.message });
    }
};
exports.removeFromCart = removeFromCart;
const updateCartItem = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { productId } = req.params;
        const { quantity } = req.body;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (quantity === undefined || quantity < 0) {
            res.status(400).json({ message: "Invalid quantity provided." });
            return;
        }
        const cart = await index_1.Cart.findOne({ where: { userId } });
        if (!cart) {
            res.status(404).json({ message: "Cart not found." });
            return;
        }
        if (quantity === 0) {
            await index_1.CartItem.destroy({
                where: { cartId: cart.id, productId: Number(productId) },
            });
            res.status(200).json({ message: "Item removed from cart." });
            return;
        }
        const product = await index_1.Product.findByPk(productId);
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        if (product.stock < quantity) {
            res.status(400).json({ message: `Not enough stock. Only ${product.stock} items available.` });
            return;
        }
        await index_1.CartItem.update({ quantity }, { where: { cartId: cart.id, productId: Number(productId) } });
        res.status(200).json({ message: "Cart updated successfully." });
    }
    catch (error) {
        console.error("UPDATE CART ERROR:", error);
        res.status(500).json({ message: "Failed to update cart.", error: error.message });
    }
};
exports.updateCartItem = updateCartItem;

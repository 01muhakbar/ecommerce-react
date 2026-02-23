import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Product } from '../models/Product.js';
import { sequelize } from "../models/index.js";
const asSingle = (v) => (Array.isArray(v) ? v[0] : v);
const toId = (v) => {
    const raw = asSingle(v);
    const id = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(id) ? id : null;
};
const toQty = (v) => {
    const raw = asSingle(v);
    if (raw === undefined || raw === null)
        return null;
    const qty = typeof raw === "string" ? Number(raw) : Number(raw);
    if (!Number.isFinite(qty) || !Number.isInteger(qty))
        return null;
    return qty;
};
const getAttr = (row, key) => row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];
const resolveCartId = async (cart, userId) => {
    let cartId = getAttr(cart, "id");
    if (!cartId && cart?.reload) {
        try {
            await cart.reload();
            cartId = getAttr(cart, "id");
        }
        catch {
            // ignore reload failure and fall back to query
        }
    }
    if (!cartId) {
        const [rows] = await sequelize.query("SELECT id FROM carts WHERE user_id = ? ORDER BY id DESC LIMIT 1", { replacements: [userId] });
        const row = Array.isArray(rows) ? rows[0] : rows;
        cartId = row?.id ?? null;
    }
    const normalized = Number(cartId);
    return Number.isFinite(normalized) ? normalized : null;
};
const toCartItemPayload = (row) => {
    const id = Number(getAttr(row, "id"));
    const cartId = Number(getAttr(row, "cartId"));
    const productId = Number(getAttr(row, "productId"));
    const quantity = Number(getAttr(row, "quantity"));
    return {
        id: Number.isFinite(id) ? id : null,
        cartId: Number.isFinite(cartId) ? cartId : null,
        productId: Number.isFinite(productId) ? productId : null,
        quantity: Number.isFinite(quantity) ? quantity : null,
    };
};
// --- CONTROLLER FUNCTIONS ---
export const addToCart = async (req, res) => {
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
        let cart = await Cart.findOne({ where: { userId } });
        if (!cart) {
            cart = await Cart.create({ userId });
        }
        const cartId = await resolveCartId(cart, userId);
        if (!cartId) {
            res.status(500).json({ message: "Failed to resolve cart id." });
            return;
        }
        const existingItem = await CartItem.findOne({
            where: { cartId, productId: productId },
        });
        if (existingItem) {
            const currentQty = Number(getAttr(existingItem, "quantity") ?? 0);
            existingItem.set("quantity", currentQty + quantity);
            await existingItem.save();
            const fresh = await CartItem.findOne({
                where: { cartId, productId: productId },
                order: [["id", "DESC"]],
            });
            if (!fresh) {
                res.status(500).json({ message: "Failed to resolve cart item." });
                return;
            }
            res.status(200).json({
                message: "Product added to cart successfully.",
                cartItem: toCartItemPayload(fresh),
            });
            return;
        }
        await CartItem.create({
            quantity: quantity,
            productId: productId,
            cartId,
        });
        const fresh = await CartItem.findOne({
            where: { cartId, productId: productId },
            order: [["id", "DESC"]],
        });
        if (!fresh) {
            res.status(500).json({ message: "Failed to resolve cart item." });
            return;
        }
        res.status(200).json({
            message: "Product added to cart successfully.",
            cartItem: toCartItemPayload(fresh),
        });
    }
    catch (error) {
        console.error("ADD TO CART ERROR:", error);
        res
            .status(500)
            .json({
            message: "Failed to add product to cart.",
            error: error.message,
        });
    }
};
export const getCart = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const cart = await Cart.findOne({
            where: { userId },
            include: [
                {
                    model: Product,
                    as: "Products",
                    through: { attributes: ["quantity"] },
                },
            ],
        });
        if (!cart) {
            res.status(200).json({ id: null, userId, Products: [] });
            return;
        }
        res.status(200).json(cart);
    }
    catch (error) {
        console.error("GET CART ERROR:", error);
        res
            .status(500)
            .json({
            message: "Failed to fetch cart.",
            error: error.message,
        });
    }
};
export const removeFromCart = async (req, res) => {
    try {
        const userId = req.user?.id;
        const id = toId(req.params.productId ?? req.params.itemId);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const cart = await Cart.findOne({ where: { userId } });
        if (!cart) {
            res.status(404).json({ message: "Cart not found." });
            return;
        }
        const cartId = await resolveCartId(cart, userId);
        if (!cartId) {
            res.status(500).json({ message: "Failed to resolve cart id." });
            return;
        }
        const deletedRows = await CartItem.destroy({
            where: {
                cartId,
                productId: id,
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
        res
            .status(500)
            .json({
            message: "Failed to remove item from cart.",
            error: error.message,
        });
    }
};
export const updateCartItem = async (req, res) => {
    try {
        const userId = req.user?.id;
        const id = toId(req.params.productId);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const { quantity } = req.body;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (quantity === undefined || quantity < 0) {
            res.status(400).json({ message: "Invalid quantity provided." });
            return;
        }
        const cart = await Cart.findOne({ where: { userId } });
        if (!cart) {
            res.status(404).json({ message: "Cart not found." });
            return;
        }
        const cartId = await resolveCartId(cart, userId);
        if (!cartId) {
            res.status(500).json({ message: "Failed to resolve cart id." });
            return;
        }
        if (quantity === 0) {
            await CartItem.destroy({
                where: { cartId, productId: id },
            });
            res.status(200).json({ message: "Item removed from cart." });
            return;
        }
        const product = await Product.findByPk(id);
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        if (product.stock < quantity) {
            res
                .status(400)
                .json({
                message: `Not enough stock. Only ${product.stock} items available.`,
            });
            return;
        }
        await CartItem.update({ quantity }, { where: { cartId, productId: id } });
        res.status(200).json({ message: "Cart updated successfully." });
    }
    catch (error) {
        console.error("UPDATE CART ERROR:", error);
        res
            .status(500)
            .json({
            message: "Failed to update cart.",
            error: error.message,
        });
    }
};
export const setCartItemQty = async (req, res) => {
    try {
        const userId = req.user?.id;
        const productId = toId(req.params.productId);
        const qty = toQty(req.body?.qty ?? req.body?.quantity);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (!productId || productId <= 0 || !Number.isInteger(productId)) {
            res.status(400).json({ message: "Invalid productId" });
            return;
        }
        if (qty === null) {
            res.status(400).json({ message: "Invalid qty" });
            return;
        }
        await sequelize.transaction(async (t) => {
            let cart = await Cart.findOne({
                where: { userId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!cart) {
                if (qty <= 0)
                    return;
                cart = await Cart.create({ userId }, { transaction: t });
            }
            const cartId = await resolveCartId(cart, userId);
            if (!cartId) {
                throw new Error("Failed to resolve cart id.");
            }
            const cartItem = await CartItem.findOne({
                where: { cartId, productId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (qty <= 0) {
                if (cartItem) {
                    await cartItem.destroy({ transaction: t });
                }
                return;
            }
            if (cartItem) {
                const currentQty = Number(getAttr(cartItem, "quantity") ?? 0);
                if (currentQty !== qty) {
                    cartItem.set("quantity", qty);
                    await cartItem.save({ transaction: t });
                }
                return;
            }
            await CartItem.create({ cartId, productId, quantity: qty }, { transaction: t });
        });
        res.status(200).json({ message: "Cart updated successfully." });
    }
    catch (error) {
        console.error("SET CART ITEM QTY ERROR:", error);
        res.status(500).json({
            message: "Failed to set cart item quantity.",
            error: error.message,
        });
    }
};

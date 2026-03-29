import { Request, Response } from 'express';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Product } from '../models/Product.js';
import { sequelize } from "../models/index.js";
import { Store } from "../models/index.js";

const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const toId = (v: unknown): number | null => {
  const raw = asSingle(v);
  const id = typeof raw === "string" ? Number(raw) : Number(raw as any);
  return Number.isFinite(id) ? id : null;
};

const toQty = (v: unknown): number | null => {
  const raw = asSingle(v);
  if (raw === undefined || raw === null) return null;
  const qty = typeof raw === "string" ? Number(raw) : Number(raw as any);
  if (!Number.isFinite(qty) || !Number.isInteger(qty)) return null;
  return qty;
};

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const resolveCartId = async (cart: any, userId: number | string) => {
  let cartId = getAttr(cart, "id");
  if (!cartId && cart?.reload) {
    try {
      await cart.reload();
      cartId = getAttr(cart, "id");
    } catch {
      // ignore reload failure and fall back to query
    }
  }
  if (!cartId) {
    const [rows] = await sequelize.query(
      "SELECT id FROM carts WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      { replacements: [userId] }
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    cartId = (row as any)?.id ?? null;
  }
  const normalized = Number(cartId);
  return Number.isFinite(normalized) ? normalized : null;
};

const toCartItemPayload = (row: any) => {
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

const isStorefrontCartEligible = (product: any) => {
  const status = String(getAttr(product, "status") || "").trim().toLowerCase();
  const isPublished = Boolean(
    getAttr(product, "isPublished") ?? getAttr(product, "published")
  );
  const submissionStatus = String(getAttr(product, "sellerSubmissionStatus") || "none")
    .trim()
    .toLowerCase();
  const storeId = Number(getAttr(product, "storeId") ?? product?.storeId ?? 0);
  const store = product?.store ?? product?.get?.("store") ?? null;
  const storeStatus = String(store?.status || "").trim().toUpperCase();
  return (
    status === "active" &&
    isPublished &&
    submissionStatus === "none" &&
    Number.isFinite(storeId) &&
    storeId > 0 &&
    storeStatus === "ACTIVE"
  );
};

const loadCartProductForMutation = async (
  productId: number,
  transaction?: any
) =>
  Product.findByPk(productId, {
    attributes: [
      "id",
      "name",
      "stock",
      "status",
      "isPublished",
      "sellerSubmissionStatus",
      "storeId",
    ],
    include: [
      {
        model: Store,
        as: "store",
        attributes: ["id", "status"],
        required: false,
      },
    ],
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

const validateCartMutationProduct = (
  product: any,
  requestedQty: number
) => {
  if (!product) {
    const error: any = new Error("Product not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!isStorefrontCartEligible(product)) {
    const error: any = new Error("Product is no longer available for purchase.");
    error.statusCode = 409;
    error.code = "PRODUCT_NOT_AVAILABLE";
    throw error;
  }

  const stock = Number(getAttr(product, "stock") ?? 0);
  if (!Number.isFinite(stock) || stock < requestedQty) {
    const error: any = new Error(
      `Not enough stock. Only ${Math.max(0, Number.isFinite(stock) ? stock : 0)} items available.`
    );
    error.statusCode = 409;
    error.code = "INSUFFICIENT_STOCK";
    throw error;
  }
};

// --- CONTROLLER FUNCTIONS ---

export const addToCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId, quantity = 1 }: { productId: number; quantity: number } =
      req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!productId) {
      res.status(400).json({ message: "Product ID is required." });
      return;
    }
    let responsePayload: any = null;

    await sequelize.transaction(async (t) => {
      let cart = await Cart.findOne({
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!cart) {
        cart = await Cart.create({ userId }, { transaction: t });
      }
      const cartId = await resolveCartId(cart, userId);
      if (!cartId) {
        throw new Error("Failed to resolve cart id.");
      }

      const product = await loadCartProductForMutation(Number(productId), t);
      const existingItem = await CartItem.findOne({
        where: { cartId, productId: productId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const currentQty = Number(getAttr(existingItem, "quantity") ?? 0);
      const nextQty = currentQty + Math.max(1, Number(quantity) || 1);
      validateCartMutationProduct(product, nextQty);

      if (existingItem) {
        existingItem.set("quantity", nextQty);
        await existingItem.save({ transaction: t });
        responsePayload = toCartItemPayload(existingItem);
        return;
      }

      const created = await CartItem.create(
        {
          quantity: Math.max(1, Number(quantity) || 1),
          productId: productId,
          cartId,
        },
        { transaction: t }
      );
      responsePayload = toCartItemPayload(created);
    });

    res.status(200).json({
      message: "Product added to cart successfully.",
      cartItem: responsePayload,
    });
  } catch (error) {
    console.error("ADD TO CART ERROR:", error);
    const statusCode = Number((error as any)?.statusCode || 500);
    res.status(statusCode).json({
      message:
        statusCode >= 400 && statusCode < 500
          ? (error as Error).message
          : "Failed to add product to cart.",
      error: (error as Error).message,
      ...(String((error as any)?.code || "").trim()
        ? { code: String((error as any).code) }
        : {}),
    });
  }
};

export const getCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
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
  } catch (error) {
    console.error("GET CART ERROR:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch cart.",
        error: (error as Error).message,
      });
  }
};

export const removeFromCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const id = toId((req.params as any).productId ?? (req.params as any).itemId);
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
  } catch (error) {
    console.error("REMOVE FROM CART ERROR:", error);
    res
      .status(500)
      .json({
        message: "Failed to remove item from cart.",
        error: (error as Error).message,
      });
  }
};

export const updateCartItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const id = toId(req.params.productId);
    if (id === null) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }
    const { quantity }: { quantity: number } = req.body;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (quantity === undefined || quantity < 0) {
      res.status(400).json({ message: "Invalid quantity provided." });
      return;
    }

    await sequelize.transaction(async (t) => {
      const cart = await Cart.findOne({
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!cart) {
        const error: any = new Error("Cart not found.");
        error.statusCode = 404;
        throw error;
      }
      const cartId = await resolveCartId(cart, userId);
      if (!cartId) {
        throw new Error("Failed to resolve cart id.");
      }

      if (quantity === 0) {
        await CartItem.destroy({
          where: { cartId, productId: id },
          transaction: t,
        });
        return;
      }

      const product = await loadCartProductForMutation(id, t);
      validateCartMutationProduct(product, quantity);

      await CartItem.update(
        { quantity },
        {
          where: { cartId, productId: id },
          transaction: t,
        }
      );
    });

    res.status(200).json({ message: "Cart updated successfully." });
  } catch (error) {
    console.error("UPDATE CART ERROR:", error);
    const statusCode = Number((error as any)?.statusCode || 500);
    res.status(statusCode).json({
      message:
        statusCode >= 400 && statusCode < 500
          ? (error as Error).message
          : "Failed to update cart.",
      error: (error as Error).message,
      ...(String((error as any)?.code || "").trim()
        ? { code: String((error as any).code) }
        : {}),
    });
  }
};

export const setCartItemQty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const productId = toId(req.params.productId);
    const qty = toQty((req.body as any)?.qty ?? (req.body as any)?.quantity);

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
        if (qty <= 0) return;
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

      const product = await loadCartProductForMutation(productId, t);
      validateCartMutationProduct(product, qty);

      if (cartItem) {
        const currentQty = Number(getAttr(cartItem, "quantity") ?? 0);
        if (currentQty !== qty) {
          cartItem.set("quantity", qty);
          await cartItem.save({ transaction: t });
        }
        return;
      }

      await CartItem.create(
        { cartId, productId, quantity: qty },
        { transaction: t }
      );
    });

    res.status(200).json({ message: "Cart updated successfully." });
  } catch (error) {
    console.error("SET CART ITEM QTY ERROR:", error);
    const statusCode = Number((error as any)?.statusCode || 500);
    res.status(statusCode).json({
      message:
        statusCode >= 400 && statusCode < 500
          ? (error as Error).message
          : "Failed to set cart item quantity.",
      error: (error as Error).message,
      ...(String((error as any)?.code || "").trim()
        ? { code: String((error as any).code) }
        : {}),
    });
  }
};


import { Request, Response } from 'express';
import { Cart, CartItem, Product, User } from '../models/index';

// Kustomisasi tipe Request dari Express untuk menyertakan properti `user`
interface CustomRequest extends Request {
  user?: User;
}

// --- CONTROLLER FUNCTIONS ---

export const addToCart = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 }: { productId: number; quantity: number } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!productId) {
      res.status(400).json({ message: "Product ID is required." });
      return;
    }

    const [cart] = await Cart.findOrCreate({
      where: { userId },
      defaults: { userId },
    });

    const [cartItem, itemCreated] = await CartItem.findOrCreate({
      where: { cartId: cart.id, productId: productId },
      defaults: { quantity: quantity, productId: productId, cartId: cart.id },
    });

    if (!itemCreated) {
      cartItem.quantity += quantity;
      await cartItem.save();
    }

    res.status(200).json({ message: "Product added to cart successfully.", cartItem });

  } catch (error) {
    console.error("ADD TO CART ERROR:", error);
    res.status(500).json({ message: "Failed to add product to cart.", error: (error as Error).message });
  }
};

export const getCart = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const cart = await Cart.findOne({
      where: { userId },
      include: [{
        model: Product,
        through: { attributes: ["quantity"] },
      }],
    });

    if (!cart) {
      res.status(200).json({ id: null, userId, Products: [] });
      return;
    }

    res.status(200).json(cart);

  } catch (error) {
    console.error("GET CART ERROR:", error);
    res.status(500).json({ message: "Failed to fetch cart.", error: (error as Error).message });
  }
};

export const removeFromCart = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const cart = await Cart.findOne({ where: { userId } });
    if (!cart) {
      res.status(404).json({ message: "Cart not found." });
      return;
    }

    const deletedRows = await CartItem.destroy({
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

  } catch (error) {
    console.error("REMOVE FROM CART ERROR:", error);
    res.status(500).json({ message: "Failed to remove item from cart.", error: (error as Error).message });
  }
};

export const updateCartItem = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;
    const { quantity }: { quantity: number } = req.body;

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

    if (quantity === 0) {
      await CartItem.destroy({
        where: { cartId: cart.id, productId: Number(productId) },
      });
      res.status(200).json({ message: "Item removed from cart." });
      return;
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    if (product.stock < quantity) {
      res.status(400).json({ message: `Not enough stock. Only ${product.stock} items available.` });
      return;
    }

    await CartItem.update(
      { quantity },
      { where: { cartId: cart.id, productId: Number(productId) } }
    );

    res.status(200).json({ message: "Cart updated successfully." });

  } catch (error) {
    console.error("UPDATE CART ERROR:", error);
    res.status(500).json({ message: "Failed to update cart.", error: (error as Error).message });
  }
};
import { Request, Response, NextFunction } from "express";
import { Op, Transaction } from "sequelize";
import {
  sequelize,
  User as UserModel,
  Cart as CartModel,
  Product as ProductModel,
  Order as OrderModel,
  OrderItem as OrderItemModel,
} from "../models";
import type { User as UserType } from "../models/User";
import type { Cart as CartType } from "../models/Cart";
import type { Product as ProductType } from "../models/Product";

// --- ENUMS & TYPES ---

export const OrderStatus = {
  Pending: "pending",
  Processing: "processing",
  Shipped: "shipped",
  Completed: "completed",
  Cancelled: "cancelled",
} as const;

type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

// --- INTERFACES ---

interface CartWithProducts extends CartType {
  Products: (ProductType & { CartItem: { quantity: number } })[];
}

// --- CONTROLLER FUNCTIONS ---

/**
 * Membuat pesanan baru dari item yang ada di keranjang pengguna.
 * Menggunakan transaksi untuk memastikan integritas data.
 */
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const t: Transaction = await sequelize.transaction();

  try {
    const cart = (await CartModel.findOne({
      where: { userId },
      include: [{ model: ProductModel, as: "Products" }],
      transaction: t,
    })) as CartWithProducts | null;

    if (!cart || !cart.Products || cart.Products.length === 0) {
      await t.rollback();
      res
        .status(400)
        .json({ message: "Keranjang kosong, tidak bisa membuat pesanan." });
      return;
    }

    let totalAmount = 0;
    const orderItemsData = cart.Products.map((product) => {
      const itemPrice = product.price;
      const itemQuantity = product.CartItem.quantity;
      totalAmount += itemPrice * itemQuantity;
      return {
        productId: product.id,
        quantity: itemQuantity,
        price: itemPrice,
      };
    });

    const invoiceNo = `INV-${Date.now()}-${userId}`;
    const order = await OrderModel.create(
      {
        userId,
        invoiceNo,
        totalAmount,
        status: "pending",
      },
      { transaction: t }
    );

    const itemsWithOrderId = orderItemsData.map((item) => ({
      ...item,
      orderId: order.id,
    }));
    await OrderItemModel.bulkCreate(itemsWithOrderId, { transaction: t });

    for (const product of cart.Products) {
      await ProductModel.update(
        { stock: sequelize.literal(`stock - ${product.CartItem.quantity}`) },
        { where: { id: product.id }, transaction: t }
      );
    }

    await (cart as any).setProducts([], { transaction: t });

    await t.commit();

    res.status(201).json({ message: "Pesanan berhasil dibuat.", order });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Mendapatkan semua pesanan milik pengguna yang sedang login.
 */
export const getUserOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const orders = await OrderModel.findAll({
      where: { userId },
      include: [
        {
          model: ProductModel,
          as: "products",
          through: { attributes: ["quantity", "price"] },
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({ status: "success", data: orders });
  } catch (error) {
    next(error);
  }
};

/**
 * Mendapatkan detail satu pesanan spesifik.
 */
export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const order = await OrderModel.findOne({
      where: { id, userId },
      include: [
        {
          model: ProductModel,
          as: "products",
          through: { attributes: ["quantity", "price"] },
        },
      ],
    });

    if (!order) {
      res.status(404).json({ message: "Pesanan tidak ditemukan." });
      return;
    }

    res.status(200).json({ status: "success", data: order });
  } catch (error) {
    next(error);
  }
};

// --- ADMIN FUNCTIONS ---

/**
 * Mendapatkan semua pesanan dari semua pengguna (Admin only).
 */
export const getAllOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit as string) || 10, 1);
    const offset = (page - 1) * limit;

    const { rows, count } = await OrderModel.findAndCountAll({
      attributes: [
        "id",
        ["invoice_no", "invoiceNo"],
        ["user_id", "userId"],
        ["total_amount", "totalAmount"],
        "status",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: UserModel,
          as: "user",
          attributes: ["id", "name"],
        },
        {
          model: OrderItemModel,
          as: "items",
          attributes: ["id", "quantity", "price", ["product_id", "productId"]],
          include: [
            {
              model: ProductModel,
              as: "product",
              attributes: ["id", ["product_name", "productName"]],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      status: "success",
      data: rows,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Memperbarui status pesanan (Admin only).
 */
export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (
      !status ||
      !Object.values(OrderStatus).includes(status as OrderStatusType)
    ) {
      res.status(400).json({
        message: `Status tidak valid. Gunakan salah satu dari: ${Object.values(
          OrderStatus
        ).join(", ")}`,
      });
      return;
    }

    const [updatedRows] = await OrderModel.update(
      { status },
      { where: { id } }
    );

    if (updatedRows === 0) {
      res.status(404).json({ message: "Pesanan tidak ditemukan." });
      return;
    }

    res.status(200).json({
      message: `Status pesanan berhasil diperbarui menjadi ${status}.`,
    });
  } catch (error) {
    next(error);
  }
};

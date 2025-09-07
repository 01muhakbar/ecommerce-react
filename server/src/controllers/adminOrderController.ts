import { Request, Response } from "express";
import initializedDbPromise from "../models/index.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";

const db = await initializedDbPromise;

// This type combines Order attributes with a potential User relation from the join.
// It extends the base Order model type.
interface OrderWithUser extends Order {
  user?: User; // The user relation is optional as it might not be found.
}

export const getOrders = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 8;
    const offset = (page - 1) * limit;

    const { count, rows: orders } = await db.Order.findAndCountAll({
      include: [
        {
          model: db.User,
          as: "user",
          attributes: ["name"], // Only fetch the user's name
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    // Cast the result to our more specific type
    const typedOrders = orders as OrderWithUser[];

    const toClientStatus = (
      serverStatus: Order["status"]
    ): "Pending" | "Processing" | "Delivered" | "Cancelled" => {
      switch (serverStatus) {
        case "pending":
          return "Pending";
        case "processing":
          return "Processing";
        case "shipped":
          return "Delivered";
        case "completed":
          return "Delivered";
        case "cancelled":
          return "Cancelled";
        default:
          // This case should ideally not be reached if all statuses are handled.
          return "Pending";
      }
    };

    // Transform data for the client
    const transformedData = typedOrders.map((order) => ({
      id: order.id,
      invoiceNo: order.invoiceNo,
      orderTime: order.createdAt.toISOString(),
      customerName: order.user?.name || "Guest",
      amount: order.totalAmount,
      status: toClientStatus(order.status),
    }));

    res.status(200).json({
      data: transformedData,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch orders",
      error: (error as Error).message,
    });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  // Placeholder implementation
  res.status(500).json({ message: "Not implemented yet" });
};

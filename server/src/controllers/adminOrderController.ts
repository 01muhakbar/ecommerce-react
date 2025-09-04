import { Request, Response } from 'express';
import db from '../models';
import { z } from 'zod';

const { Order, User } = db;

// Define a type for the order object that includes the user
// @ts-ignore
interface OrderWithUser extends Order {
  // @ts-ignore
  user: User;
}

const statusSchema = z.object({
  status: z.enum(['pending', 'completed', 'cancelled']),
});

export const getOrders = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 8;
  const offset = (page - 1) * limit;

  try {
    const { count, rows } = await Order.findAndCountAll({
      limit,
      offset,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const totalPages = Math.ceil(count / limit);

    const data = (rows as OrderWithUser[]).map(order => ({
      id: order.id,
      invoiceNo: order.id,
      orderTime: order.createdAt, // Use createdAt
      customerName: order.user.name, // Use user.name
      amount: order.totalAmount,
      status: order.status,
    }));

    res.json({
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count,
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const validation = statusSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({ message: 'Invalid status provided', errors: validation.error.issues });
  }

  const { status } = validation.data;

  try {
    const order = await Order.findByPk(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    await order.save();

    res.json({ message: 'Order status updated successfully', order });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models';

export const createStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'admin', // Default to admin, or could be 'staff'
    });

    // Exclude password from the output
    const userResponse = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
    };

    res.status(201).json({
      status: 'success',
      data: {
        user: userResponse,
      },
    });

  } catch (error) {
    if ((error as any).name === 'SequelizeUniqueConstraintError') {
      res.status(400).json({ status: 'fail', message: 'Email sudah terdaftar.' });
      return;
    }
    console.error("CREATE STAFF ERROR:", error);
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
};

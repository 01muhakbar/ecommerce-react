import { Op } from 'sequelize';
import { Request, Response } from 'express';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';

const sortMap: Record<string, string> = { createdAt: 'created_at', name: 'name', email: 'email' };

export const getStaff = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const q = (req.query.q as string) ?? '';
    const role = (req.query.role as string) || undefined;
    const sortBy = sortMap[String(req.query.sortBy ?? 'createdAt')] ?? 'created_at';
    const sort = (String(req.query.sort ?? 'DESC').toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const where: any = {};
    if (q) where[Op.or] = [
      { name: { [Op.like]: `%${q}%` } },
      { email: { [Op.like]: `%${q}%` } },
      { phoneNumber: { [Op.like]: `%${q}%` } },
    ];
    if (role) where.role = role;

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: ['id','name','email','phoneNumber','role','isActive','isPublished','createdAt'],
      order: [[sortBy, sort]],
      limit,
      offset: (page - 1) * limit,
    });

    return res.json({
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count/limit) }
    });
  } catch (err: any) {
    console.error('ADMIN GET STAFF ERROR:', err?.parent ?? err);
    return res.status(500).json({ message: 'Failed to fetch staff' });
  }
};

export const createStaff = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, role, password, isActive = true, isPublished = true } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const u = await User.create({ name, email, phoneNumber: phone, role, password: hashed, isActive, isPublished });
    res.status(201).json(u);
  } catch (err: any) {
    console.error('ADMIN CREATE STAFF ERROR:', err?.parent ?? err);
    res.status(400).json({ message: 'Failed to create staff' });
  }
};

export const updateStaff = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, email, phone, role, isActive, isPublished } = req.body;
    const [n] = await User.update({ name, email, phoneNumber: phone, role, isActive, isPublished }, { where: { id } });
    if (!n) return res.status(404).json({ message: 'Not found' });
    const fresh = await User.findByPk(id, { attributes: ['id','name','email','phoneNumber','role','isActive','isPublished'] });
    res.json(fresh);
  } catch (err: any) {
    console.error('ADMIN UPDATE STAFF ERROR:', err?.parent ?? err);
    res.status(400).json({ message: 'Failed to update staff' });
  }
};

export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const n = await User.destroy({ where: { id } });
    if (!n) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('ADMIN DELETE STAFF ERROR:', err?.parent ?? err);
    res.status(400).json({ message: 'Failed to delete staff' });
  }
};

export const toggleActive = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ id: user.id, isActive: user.isActive });
  } catch (err: any) {
    console.error('ADMIN TOGGLE ACTIVE ERROR:', err?.parent ?? err);
    res.status(400).json({ message: 'Failed to toggle' });
  }
};

export const togglePublished = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    user.isPublished = !user.isPublished;
    await user.save();
    res.json({ id: user.id, isPublished: user.isPublished });
  } catch (err: any) {
    console.error('ADMIN TOGGLE PUBLISHED ERROR:', err?.parent ?? err);
    res.status(400).json({ message: 'Failed to toggle' });
  }
};

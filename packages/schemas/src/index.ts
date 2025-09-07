import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["pembeli", "penjual"]).optional(),
});

export const loginAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const forgotPasswordAdminSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordAdminSchema = z.object({
  password: z.string().min(6),
  token: z.string(),
});

export const updateProfileSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export const createProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  description: z.string(),
  stock: z.number(),
  categoryId: z.number(),
  images: z.array(z.string()).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginAdminInput = z.infer<typeof loginAdminSchema>;
export type ForgotPasswordAdminInput = z.infer<
  typeof forgotPasswordAdminSchema
>;
export type ResetPasswordAdminInput = z.infer<typeof resetPasswordAdminSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
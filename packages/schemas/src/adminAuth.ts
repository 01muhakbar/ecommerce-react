import { z } from 'zod';

export const loginAdminSchema = z.object({
  email: z.string().email({ message: 'Format email tidak valid.' }),
  password: z.string().min(1, { message: 'Password tidak boleh kosong.' }),
});

export const createAdminSchema = z.object({
  name: z.string().min(1, { message: 'Nama tidak boleh kosong.' }),
  email: z.string().email({ message: 'Format email tidak valid.' }),
  password: z.string().min(8, { message: 'Password minimal harus 8 karakter.' }),
  role: z.string().optional().default('admin'),
});

export const forgotPasswordAdminSchema = z.object({
  email: z.string().email({ message: 'Format email tidak valid.' }),
});

export const resetPasswordAdminSchema = z.object({
  password: z.string().min(8, { message: 'Password baru minimal harus 8 karakter.' }),
});

export type LoginAdminInput = z.infer<typeof loginAdminSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type ForgotPasswordAdminInput = z.infer<typeof forgotPasswordAdminSchema>;
export type ResetPasswordAdminInput = z.infer<typeof resetPasswordAdminSchema>;

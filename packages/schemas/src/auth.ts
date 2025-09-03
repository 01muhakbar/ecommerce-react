import { z } from "zod";

// Skema validasi untuk login pengguna biasa
// Pastikan ada kata kunci 'export' di sini
export const loginSchema = z.object({
  email: z.string().email({ message: "Format email tidak valid" }),
  password: z.string().min(1, { message: "Password tidak boleh kosong" }),
});

// Tipe data yang di-infer dari skema untuk digunakan di TypeScript
export type LoginInput = z.infer<typeof loginSchema>;

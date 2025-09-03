import { z } from "zod";
// Skema validasi untuk login pengguna biasa
// Pastikan ada kata kunci 'export' di sini
export const loginSchema = z.object({
    email: z.string().email({ message: "Format email tidak valid" }),
    password: z.string().min(1, { message: "Password tidak boleh kosong" }),
});

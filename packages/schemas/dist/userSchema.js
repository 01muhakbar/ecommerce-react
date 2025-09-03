import { z } from "zod";
// Skema untuk registrasi pengguna baru
export const registerSchema = z.object({
    name: z.string().min(1, { message: "Nama tidak boleh kosong" }),
    email: z.string().email({ message: "Format email tidak valid" }),
    password: z.string().min(6, { message: "Password minimal harus 6 karakter" }),
});
// Skema untuk memperbarui profil pengguna
export const updateProfileSchema = z.object({
    name: z.string().min(1, "Nama tidak boleh kosong").optional(),
    // Tambahkan field lain yang bisa diupdate di sini jika perlu
});

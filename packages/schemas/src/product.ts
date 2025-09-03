import { z } from "zod";

// Skema untuk membuat produk baru.
// Didasarkan pada controller `createProduct` dan kemungkinan input dari form.
// Angka dan boolean bisa dikirim sebagai string dari `multipart/form-data`,
// jadi kita validasi sebagai string lalu refine/transform.
export const createProductSchema = z.object({
  name: z.string().min(1, "Nama produk tidak boleh kosong"),
  description: z.string().min(1, "Deskripsi produk tidak boleh kosong"),
  price: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Harga harus berupa angka positif",
    }),
  stock: z
    .string()
    .refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 0, {
      message: "Stok harus berupa angka non-negatif",
    }),
  categoryId: z.string().min(1, "Kategori harus dipilih"),
  // Tambahkan validasi untuk field lain yang wajib di sini jika ada
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

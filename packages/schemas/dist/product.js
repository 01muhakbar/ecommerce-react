import { z } from "zod";
// Skema ini sekarang disamakan dengan productAdminSchema untuk konsistensi.
// Menggunakan z.preprocess untuk menangani input dari form (yang seringkali berupa string)
// dan mengubahnya menjadi tipe data yang benar (number) sebelum validasi.
export const createProductSchema = z.object({
    name: z.string().min(1, { message: "Nama produk tidak boleh kosong." }),
    description: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    categoryId: z.preprocess((val) => {
        if (val === "" || val === null)
            return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z
        .number({
        required_error: "Kategori harus dipilih.",
        invalid_type_error: "Kategori tidak valid.",
    })
        .int()
        .positive("Kategori tidak valid.")),
    price: z.preprocess((val) => (val === "" || val === null ? undefined : val), z
        .number({
        required_error: "Harga produk tidak boleh kosong.",
        invalid_type_error: "Harga produk harus berupa angka.",
    })
        .positive({ message: "Harga produk harus positif." })),
    salePrice: z.preprocess((val) => (val === "" || val === null ? undefined : val), z
        .number({ invalid_type_error: "Harga diskon harus berupa angka." })
        .positive({ message: "Harga diskon harus positif." })
        .optional()
        .or(z.literal(""))),
    quantity: z.preprocess((val) => (val === "" || val === null ? undefined : val), z
        .number({
        required_error: "Jumlah produk tidak boleh kosong.",
        invalid_type_error: "Jumlah produk harus berupa angka.",
    })
        .int()
        .min(0, { message: "Jumlah produk tidak boleh kurang dari 0." })),
    slug: z
        .string()
        .min(1, { message: "Slug tidak boleh kosong." })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung (-)."),
    tags: z.array(z.string()).optional(),
    images: z.any().optional(),
});

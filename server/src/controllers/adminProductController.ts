import express from "express";
import { Op } from "sequelize";
import { initializedDbPromise } from "../models/index.js";
import { AppError } from "../middleware/errorMiddleware.js";

const db = await initializedDbPromise;
const { Product, Category, User } = db;

// Helper function to generate a unique slug
const generateUniqueSlug = async (name: string): Promise<string> => {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // collapse whitespace and replace by -
    .replace(/-+/g, "-"); // collapse dashes

  if (!slug) {
    slug = "product"; // Fallback if name results in empty slug
  }

  let uniqueSlug = slug;
  let counter = 1;
  while (await Product.findOne({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }
  return uniqueSlug;
};

/**
 * Mendapatkan semua produk dengan paginasi, pencarian, dan filter.
 * GET /api/v1/admin/products
 */
export const getAllProducts = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const offset = (page - 1) * limit;

    const { search, category, price_min, price_max } = req.query;

    const whereClause: any = {};

    if (search) {
      whereClause.name = { [Op.like]: `%${search}%` };
    }
    if (category) {
      whereClause.categoryId = category;
    }
    if (price_min) {
      whereClause.price = { ...whereClause.price, [Op.gte]: price_min };
    }
    if (price_max) {
      whereClause.price = { ...whereClause.price, [Op.lte]: price_max };
    }

    const { count, rows } = await Product.findAndCountAll({
      where: whereClause,
      attributes: [
        "id",
        "name",
        "price",
        "salePrice",
        "stock",
        "isPublished",
        "slug",
        "createdAt",
      ],
      include: [
        {
          model: User,
          as: "seller",
          attributes: ["id", "name"],
        },
        { model: Category, as: "category", attributes: ["name"] },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      status: "success",
      data: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("--- ERROR FETCHING PRODUCTS ---");
    console.error(error); // <-- INI YANG PALING PENTING
    res.status(500).json({
      status: "error",
      message: "Gagal mengambil data produk.",
      error: (error as Error).message,
    });
  }
};

/**
 * Mendapatkan satu produk berdasarkan ID.
 * GET /api/v1/admin/products/:id
 */
export const getProductById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Category, as: "category" }],
    });
    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan." });
    }
    res.status(200).json({ status: "success", data: product });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Gagal mengambil produk." });
  }
};

/**
 * Membuat produk baru.
 * POST /api/v1/admin/products
 */
export const createProduct = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // 1. Log untuk memastikan controller terpanggil
  console.log("--- createProduct Controller Invoked ---");

  try {
    // 2. Log untuk melihat isi req.body dan req.files setelah middleware (multer)
    console.log("req.body:", JSON.stringify(req.body, null, 2));
    console.log("req.files:", req.files);

    // Menggunakan tipe yang lebih aman untuk req.user
    const user = (req as any).user;
    const userId = user?.id;
    if (!userId) {
      // Gunakan AppError untuk konsistensi
      return next(new Error("Unauthorized: User not found in request."));
    }

    const {
      name,
      tags,
      stock,
      price,
      categoryId,
      // Explicitly list all expected fields from the form
      description,
      sku,
      weight,
      barcode,
      salePrice,
      slug,
    } = req.body;

    // Generate slug dari nama produk jika tidak disediakan, atau pastikan unik jika disediakan.
    const finalSlug = await generateUniqueSlug(slug || name);

    // Proses path gambar dari req.files
    let imagePaths: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      imagePaths = req.files.map(
        (file: Express.Multer.File) => `/uploads/products/${file.filename}`
      );
    }

    // Persiapkan data untuk dimasukkan ke database
    // Pastikan semua tipe data sesuai dengan model Sequelize
    // (misal: string ke number, string JSON ke object)
    const newProduct = await Product.create({
      name,
      description,
      sku,
      barcode,
      slug: finalSlug, // Pastikan slug dimasukkan
      price: parseFloat(price),
      weight: parseInt(weight, 10),
      salePrice: salePrice ? parseFloat(salePrice) : undefined, // Use undefined to match model type
      stock: parseInt(stock, 10),
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      userId,
      imagePaths: imagePaths.length > 0 ? imagePaths : [],
      tags: tags ? JSON.parse(tags) : [],
      isPublished: true, // Default ke published saat dibuat
    });

    // 3. Ambil kembali data produk lengkap dengan relasinya untuk dikirim ke client
    const productWithRelations = await Product.findByPk(newProduct.id, {
      include: [{ model: Category, as: "category" }],
    });

    res.status(201).json({
      status: "success",
      message: "Produk berhasil ditambahkan.",
      data: productWithRelations,
    });
  } catch (err: any) {
    // Log semua error yang terjadi di controller ini ke terminal
    console.error("--- ERROR in createProduct Controller ---");
    console.error(err);
    // Teruskan error ke global error handler untuk dikirim ke client
    next(err);
  }
};

/**
 * Memperbarui produk.
 * PUT /api/v1/admin/products/:id
 */
export const updateProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const [updatedRows] = await Product.update(req.body, { where: { id } });
    if (updatedRows === 0) {
      return res.status(404).json({ message: "Produk tidak ditemukan." });
    }
    const updatedProduct = await Product.findByPk(id);
    res.status(200).json({ status: "success", data: updatedProduct });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Gagal memperbarui produk." });
  }
};

/**
 * Menghapus produk.
 * DELETE /api/v1/admin/products/:id
 */
export const deleteProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const deletedRows = await Product.destroy({ where: { id } });
    if (deletedRows === 0) {
      return res.status(404).json({ message: "Produk tidak ditemukan." });
    }
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Gagal menghapus produk." });
  }
};

/**
 * Mengubah status publish produk.
 * PATCH /api/v1/admin/products/:id/toggle-publish
 */
export const togglePublishStatus = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan." });
    }
    product.isPublished = !product.isPublished;
    await product.save();
    res.status(200).json({
      status: "success",
      message: `Status produk berhasil diubah menjadi ${
        product.isPublished ? "Published" : "Unpublished"
      }.`,
      data: product,
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Gagal mengubah status produk." });
  }
};

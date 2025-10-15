import { Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import { Product, Category, User } from "../models";
import { AppError } from "../middleware/errorMiddleware";

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
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const offset = (page - 1) * limit;

    const { search, category, price_min, price_max } = req.query as {
      [key: string]: string;
    };

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
        "published",
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
    next(error);
  }
};

/**
 * Mendapatkan satu produk berdasarkan ID.
 * GET /api/v1/admin/products/:id
 */
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Category, as: "category" }],
    });
    if (!product) {
      return next(new AppError("Produk tidak ditemukan.", 404));
    }
    res.status(200).json({ status: "success", data: product });
  } catch (error) {
    next(error);
  }
};

/**
 * Membuat produk baru.
 * POST /api/v1/admin/products
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    if (!userId) {
      return next(
        new AppError("Unauthorized: User not found in request.", 401)
      );
    }

    const {
      name,
      tags,
      stock,
      price,
      categoryId,
      description,
      sku,
      weight,
      barcode,
      salePrice,
      slug,
    } = req.body as { [key: string]: any };

    const finalSlug = await generateUniqueSlug(slug || name);

    let imagePaths: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      imagePaths = req.files.map(
        (file: Express.Multer.File) => `/uploads/products/${file.filename}`
      );
    }

    const newProduct = await Product.create({
      name,
      description,
      sku,
      barcode,
      slug: finalSlug,
      price: parseFloat(price),
      weight: parseInt(weight, 10),
      salePrice: salePrice ? parseFloat(salePrice) : undefined,
      stock: parseInt(stock, 10),
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      userId,
      imagePaths: imagePaths.length > 0 ? imagePaths : [],
      tags: tags ? JSON.parse(tags) : [],
      isPublished: true,
    });

    const productWithRelations = await Product.findByPk(newProduct.id, {
      include: [{ model: Category, as: "category" }],
    });

    res.status(201).json({
      status: "success",
      message: "Produk berhasil ditambahkan.",
      data: productWithRelations,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Memperbarui produk.
 * PUT /api/v1/admin/products/:id
 */
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);

    if (!product) {
      return next(new AppError("Produk tidak ditemukan.", 404));
    }

    const {
      name,
      description,
      sku,
      barcode,
      price,
      weight,
      salePrice,
      stock,
      categoryId,
      tags,
      isPublished,
      slug,
    } = req.body;

    const payload: { [key: string]: any } = {};
    if (name !== undefined) payload.name = name;
    if (description !== undefined) payload.description = description;
    if (sku !== undefined) payload.sku = sku;
    if (barcode !== undefined) payload.barcode = barcode;
    if (price !== undefined) payload.price = parseFloat(price);
    if (weight !== undefined) payload.weight = parseInt(weight, 10);
    if (salePrice !== undefined) payload.salePrice = parseFloat(salePrice);
    if (stock !== undefined) payload.stock = parseInt(stock, 10);
    if (categoryId !== undefined) payload.categoryId = parseInt(categoryId, 10);
    if (tags !== undefined) payload.tags = tags;
    if (isPublished !== undefined) payload.isPublished = isPublished;

    if (slug && slug !== product.slug) {
      payload.slug = await generateUniqueSlug(slug);
    }

    const [updatedRows] = await Product.update(payload, { where: { id } });

    if (updatedRows === 0) {
      return next(
        new AppError("Produk tidak ditemukan atau tidak ada perubahan.", 404)
      );
    }

    const updatedProduct = await Product.findByPk(id, {
      include: [{ model: Category, as: "category" }],
    });

    res.status(200).json({
      status: "success",
      message: "Produk berhasil diperbarui.",
      data: updatedProduct,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menghapus produk.
 * DELETE /api/v1/admin/products/:id
 */
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const deletedRows = await Product.destroy({ where: { id } });
    if (deletedRows === 0) {
      return next(new AppError("Produk tidak ditemukan.", 404));
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Mengubah status publish produk.
 * PATCH /api/v1/admin/products/:id/toggle-publish
 */
export const togglePublishStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) {
      return next(new AppError("Produk tidak ditemukan.", 404));
    }
    const newPublished = !product.isPublished;
    product.isPublished = newPublished;
    await product.save();
    res.status(200).json({
      status: "success",
      message: `Status produk berhasil diubah menjadi ${
        newPublished ? "Published" : "Unpublished"
      }.`,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

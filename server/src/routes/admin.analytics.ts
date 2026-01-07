import { Router } from "express";
import { fn, col } from "sequelize";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const models = require("../../../models/index.js");

const { Product, OrderItem } = models;
const router = Router();

// GET /api/admin/analytics/best-selling?limit=5
router.get("/best-selling", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 5)));

    if (OrderItem && Product) {
      try {
        // Step 1: aggregate best-selling by productId
        const baseRows = await OrderItem.findAll({
          attributes: [
            [col("OrderItem.product_id"), "productId"],
            [fn("SUM", col("OrderItem.quantity")), "qty"],
          ],
          group: [col("OrderItem.product_id")],
          order: [[fn("SUM", col("OrderItem.quantity")), "DESC"]],
          limit,
          raw: true as true,
        });

        const productIds = baseRows.map((r: any) => r.productId).filter(Boolean);
        const products = productIds.length
          ? await Product.findAll({
              where: { id: productIds },
              attributes: [
                "id",
                "productName",
                "price",
                "slug",
                "promoImagePath",
                "imagePaths",
              ],
              raw: true as true,
            })
          : [];
        const idx = new Map(products.map((p: any) => [p.id, p]));

        const items = baseRows.map((r: any) => {
          const p: any = idx.get(r.productId) || {};
          const mainImageUrl =
            p.promoImagePath || (Array.isArray(p.imagePaths) ? p.imagePaths[0] : null) || null;
          return {
            productId: r.productId,
            name: p.productName ?? "Unknown",
            sales: Number(r.qty) || 0,
            price: p.price ?? null,
            slug: p.slug ?? null,
            mainImageUrl,
          };
        });

        return res.json({ items });
      } catch (e) {
        console.warn("[analytics] baseRows aggregation failed; falling back", e);
        // Fall through to fallback below
      }
    }

    // Fallback minimal jika belum ada OrderItem:
    const products = await Product.findAll({
      limit,
      order: [["created_at", "DESC"]],
      // Match actual Product fields
      attributes: [
        "id",
        "productName",
        "price",
        "slug",
        "promoImagePath",
        "imagePaths",
      ],
    });
    const items = products.map((p: any) => {
      const mainImageUrl = p.promoImagePath || (Array.isArray(p.imagePaths) ? p.imagePaths[0] : null) || null;
      return {
        productId: p.id,
        name: p.productName,
        sales: 0,
        price: p.price,
        slug: p.slug,
        mainImageUrl,
      };
    });
    return res.json({ items });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const router = Router();

const parseId = (value: any) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// GET /api/admin/products/:id/attributes
router.get("/products/:id/attributes", async (req, res, next) => {
  try {
    const productId = parseId(req.params.id);
    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id" });
    }

    const rows = await sequelize.query(
      `SELECT a.id AS attributeId, a.name AS attributeName,
              pav.attribute_value_id AS valueId, av.value AS value
       FROM attributes a
       LEFT JOIN product_attribute_values pav
         ON pav.attribute_id = a.id AND pav.product_id = ?
       LEFT JOIN attribute_values av
         ON av.id = pav.attribute_value_id
       ORDER BY a.name ASC`,
      { replacements: [productId], type: QueryTypes.SELECT },
    );

    return res.json({ success: true, data: rows });
  } catch (error: any) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    if (code === "ER_NO_SUCH_TABLE") {
      return res
        .status(200)
        .json({
          success: true,
          data: [],
          warning: "product_attribute_values table not found",
        });
    }
    return next(error);
  }
});

// PUT /api/admin/products/:id/attributes
router.put("/products/:id/attributes", async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const productId = parseId(req.params.id);
    if (!productId) {
      await tx.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id" });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const payload = items
      .map((item: any) => ({
        attributeId: parseId(item?.attributeId),
        valueId: parseId(item?.valueId),
      }))
      .filter((item: any) => item.attributeId && item.valueId);

    try {
      await sequelize.query(
        "DELETE FROM product_attribute_values WHERE product_id = ?",
        { replacements: [productId], transaction: tx },
      );

      if (payload.length > 0) {
        const valuesSql = payload
          .map(() => "(?, ?, ?, NOW(), NOW())")
          .join(", ");
        const replacements = payload.flatMap((item: any) => [
          productId,
          item.attributeId,
          item.valueId,
        ]);
        await sequelize.query(
          `INSERT INTO product_attribute_values (product_id, attribute_id, attribute_value_id, created_at, updated_at)
           VALUES ${valuesSql}`,
          { replacements, transaction: tx },
        );
      }

      await tx.commit();
      return res.json({ success: true });
    } catch (error: any) {
      const code = error?.original?.code || error?.parent?.code || error?.code;
      if (code === "ER_NO_SUCH_TABLE") {
        await tx.rollback();
        return res
          .status(200)
          .json({
            success: true,
            warning: "product_attribute_values table not found",
          });
      }
      throw error;
    }
  } catch (error) {
    await tx.rollback();
    return next(error);
  }
});

export default router;

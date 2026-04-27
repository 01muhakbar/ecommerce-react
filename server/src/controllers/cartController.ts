import { Request, Response } from 'express';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Product } from '../models/Product.js';
import { sequelize } from "../models/index.js";
import { Store } from "../models/index.js";
import { buildPublicStoreOperationalReadiness } from "../services/sharedContracts/publicStoreIdentity.js";
import { STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES } from "../services/sharedContracts/storePaymentProfileCompat.js";

const CART_ITEM_VARIANT_FIELD_COLUMN_MAP = {
  variantKey: "variant_key",
  variantLabel: "variant_label",
  variantSelections: "variant_selections",
  variantSkuSnapshot: "variant_sku_snapshot",
  variantBarcodeSnapshot: "variant_barcode_snapshot",
  unitPriceSnapshot: "unit_price_snapshot",
  unitSalePriceSnapshot: "unit_sale_price_snapshot",
  variantImageSnapshot: "variant_image_snapshot",
} as const;

const CART_ITEM_VARIANT_FIELDS = Object.keys(
  CART_ITEM_VARIANT_FIELD_COLUMN_MAP
) as Array<keyof typeof CART_ITEM_VARIANT_FIELD_COLUMN_MAP>;

const CART_ITEM_SNAPSHOT_FIELDS = [
  "variantKey",
  "variantLabel",
  "variantSelections",
  "variantSkuSnapshot",
  "variantBarcodeSnapshot",
  "unitPriceSnapshot",
  "unitSalePriceSnapshot",
  "variantImageSnapshot",
] as const;

let cartItemVariantFieldSupportPromise: Promise<
  Set<keyof typeof CART_ITEM_VARIANT_FIELD_COLUMN_MAP>
> | null = null;

const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const toId = (v: unknown): number | null => {
  const raw = asSingle(v);
  const id = typeof raw === "string" ? Number(raw) : Number(raw as any);
  return Number.isFinite(id) ? id : null;
};

const toQty = (v: unknown): number | null => {
  const raw = asSingle(v);
  if (raw === undefined || raw === null) return null;
  const qty = typeof raw === "string" ? Number(raw) : Number(raw as any);
  if (!Number.isFinite(qty) || !Number.isInteger(qty)) return null;
  return qty;
};

const normalizeJsonValue = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeUploadsUrl = (value?: string | null) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return text;
  return `/uploads/${text}`;
};

const createControllerError = (
  message: string,
  options: {
    statusCode?: number;
    code?: string;
    meta?: Record<string, unknown> | null;
  } = {}
) => {
  const error: any = new Error(message);
  error.statusCode = Number(options.statusCode || 500);
  error.code = String(options.code || "").trim() || undefined;
  error.meta = options.meta ?? undefined;
  return error;
};

const sendControllerError = (
  res: Response,
  error: unknown,
  fallbackMessage: string
) => {
  const statusCode = Number((error as any)?.statusCode || 500);
  const code = String((error as any)?.code || "").trim();
  const meta = (error as any)?.meta;
  res.status(statusCode).json({
    message:
      statusCode >= 400 && statusCode < 500
        ? (error as Error).message
        : fallbackMessage,
    error: (error as Error).message,
    ...(code ? { code } : {}),
    ...(meta && typeof meta === "object" ? { meta } : {}),
  });
};

const normalizeVariantSelectionCompareKey = (selection: any) =>
  `${Number(selection?.attributeId) || 0}:${String(selection?.valueId ?? selection?.value ?? "")
    .trim()
    .toLowerCase()}`;

const buildVariantCombinationKey = (selections: any[]) =>
  (Array.isArray(selections) ? selections : []).map(normalizeVariantSelectionCompareKey).join("|");

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const getCartItemSupportedVariantFields = async () => {
  if (!cartItemVariantFieldSupportPromise) {
    cartItemVariantFieldSupportPromise = (async () => {
      const queryInterface = sequelize.getQueryInterface();
      let description: Record<string, any> = {};
      try {
        description = (await queryInterface.describeTable("cart_items")) as Record<string, any>;
      } catch {
        try {
          description = (await queryInterface.describeTable("CartItems")) as Record<string, any>;
        } catch {
          description = {};
        }
      }
      const columns = new Set(Object.keys(description || {}));
      return new Set(
        CART_ITEM_VARIANT_FIELDS.filter((field) =>
          columns.has(CART_ITEM_VARIANT_FIELD_COLUMN_MAP[field])
        )
      );
    })();
  }
  return cartItemVariantFieldSupportPromise;
};

const buildSupportedCartItemSnapshotFields = (
  snapshot: Record<string, any>,
  supportedFields: Set<keyof typeof CART_ITEM_VARIANT_FIELD_COLUMN_MAP>
) =>
  CART_ITEM_SNAPSHOT_FIELDS.reduce((acc, field) => {
    if (supportedFields.has(field as keyof typeof CART_ITEM_VARIANT_FIELD_COLUMN_MAP)) {
      acc[field] = snapshot[field];
    }
    return acc;
  }, {} as Record<string, any>);

const buildCartItemQueryAttributes = (
  supportedFields: Set<keyof typeof CART_ITEM_VARIANT_FIELD_COLUMN_MAP>
) => [
  "id",
  "cartId",
  "productId",
  "quantity",
  ...CART_ITEM_VARIANT_FIELDS.filter((field) => supportedFields.has(field)),
];

const buildCartItemLookupWhere = (
  cartId: number,
  productId: number,
  variantKey: string | null,
  supportedFields: Set<keyof typeof CART_ITEM_VARIANT_FIELD_COLUMN_MAP>
) => ({
  cartId,
  productId,
  ...(supportedFields.has("variantKey") ? { variantKey } : {}),
});

const resolveCartId = async (cart: any, userId: number | string) => {
  let cartId = getAttr(cart, "id");
  if (!cartId && cart?.reload) {
    try {
      await cart.reload();
      cartId = getAttr(cart, "id");
    } catch {
      // ignore reload failure and fall back to query
    }
  }
  if (!cartId) {
    const [rows] = await sequelize.query(
      "SELECT id FROM carts WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      { replacements: [userId] }
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    cartId = (row as any)?.id ?? null;
  }
  const normalized = Number(cartId);
  return Number.isFinite(normalized) ? normalized : null;
};

const toCartItemPayload = (row: any) => {
  const id = Number(getAttr(row, "id"));
  const cartId = Number(getAttr(row, "cartId"));
  const productId = Number(getAttr(row, "productId"));
  const quantity = Number(getAttr(row, "quantity"));
  const variantSelections = normalizeJsonValue(getAttr(row, "variantSelections"));
  return {
    id: Number.isFinite(id) ? id : null,
    cartId: Number.isFinite(cartId) ? cartId : null,
    productId: Number.isFinite(productId) ? productId : null,
    quantity: Number.isFinite(quantity) ? quantity : null,
    variantKey: String(getAttr(row, "variantKey") || "").trim() || null,
    variantLabel: String(getAttr(row, "variantLabel") || "").trim() || null,
    variantSelections: Array.isArray(variantSelections) ? variantSelections : [],
    variantSkuSnapshot: String(getAttr(row, "variantSkuSnapshot") || "").trim() || null,
    variantBarcodeSnapshot: String(getAttr(row, "variantBarcodeSnapshot") || "").trim() || null,
    unitPriceSnapshot: Number(getAttr(row, "unitPriceSnapshot") ?? 0) || 0,
    unitSalePriceSnapshot: Number(getAttr(row, "unitSalePriceSnapshot") ?? 0) || 0,
    variantImageSnapshot: normalizeUploadsUrl(getAttr(row, "variantImageSnapshot")),
  };
};

const normalizeProductVariationState = (value: unknown) => {
  const normalized = normalizeJsonValue(value);
  if (!normalized || typeof normalized !== "object") {
    return {
      hasVariants: false,
      variants: [],
    };
  }
  const raw = Array.isArray(normalized)
    ? { hasVariants: normalized.length > 0, variants: normalized }
    : (normalized as Record<string, any>);
  const variants = (Array.isArray(raw?.variants) ? raw.variants : [])
    .map((entry: any, index: number) => {
      const selections = Array.isArray(entry?.selections)
        ? entry.selections
            .map((selection: any) => {
              const attributeId = Number(selection?.attributeId);
              const attributeName = String(selection?.attributeName || "").trim();
              const valueText = String(selection?.value || "").trim();
              if (!Number.isInteger(attributeId) || attributeId <= 0 || !attributeName || !valueText) {
                return null;
              }
              return {
                attributeId,
                attributeName,
                valueId: selection?.valueId ?? null,
                value: valueText,
              };
            })
            .filter(Boolean)
        : [];

      const combination = String(entry?.combination || "").trim();
      const combinationKey = String(
        entry?.combinationKey || buildVariantCombinationKey(selections)
      ).trim();
      if (!combination || !combinationKey || selections.length === 0) return null;

      return {
        id: String(entry?.id || `variant-${index + 1}`),
        combination,
        combinationKey,
        selections,
        sku: String(entry?.sku || "").trim() || null,
        barcode: String(entry?.barcode || "").trim() || null,
        price:
          entry?.price === null || typeof entry?.price === "undefined" || entry?.price === ""
            ? null
            : Number(entry.price),
        salePrice:
          entry?.salePrice === null ||
          typeof entry?.salePrice === "undefined" ||
          entry?.salePrice === ""
            ? null
            : Number(entry.salePrice),
        quantity:
          entry?.quantity === null || typeof entry?.quantity === "undefined" || entry?.quantity === ""
            ? null
            : Math.max(0, Math.round(Number(entry.quantity))),
        image: normalizeUploadsUrl(entry?.image ? String(entry.image) : null),
      };
    })
    .filter(Boolean);

  return {
    hasVariants: Boolean(raw?.hasVariants) || variants.length > 0,
    variants,
  };
};

const getProductPrimaryImage = (product: any) => {
  const promo = normalizeUploadsUrl(String(getAttr(product, "promoImagePath") || "").trim() || null);
  if (promo) return promo;
  const rawImages = normalizeJsonValue(getAttr(product, "imagePaths"));
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    return normalizeUploadsUrl(String(rawImages[0] || "").trim() || null);
  }
  return null;
};

const buildCartReadProductSnapshot = (product: any, cartItem: any) => {
  const normalizedVariantSelections = normalizeJsonValue(getAttr(cartItem, "variantSelections"));
  const snapshot = {
    id: toId(getAttr(cartItem, "id")),
    quantity: Number(getAttr(cartItem, "quantity") ?? 0),
    variantKey: String(getAttr(cartItem, "variantKey") || "").trim() || null,
    variantLabel: String(getAttr(cartItem, "variantLabel") || "").trim() || null,
    variantSelections: Array.isArray(normalizedVariantSelections)
      ? normalizedVariantSelections
      : [],
    variantSkuSnapshot: String(getAttr(cartItem, "variantSkuSnapshot") || "").trim() || null,
    variantBarcodeSnapshot:
      String(getAttr(cartItem, "variantBarcodeSnapshot") || "").trim() || null,
    unitPriceSnapshot: getAttr(cartItem, "unitPriceSnapshot"),
    unitSalePriceSnapshot: getAttr(cartItem, "unitSalePriceSnapshot"),
    variantImageSnapshot:
      normalizeUploadsUrl(String(getAttr(cartItem, "variantImageSnapshot") || "").trim() || null),
  };

  if (!product) return null;
  product.setDataValue?.("CartItem", snapshot);
  (product as any).CartItem = snapshot;
  return product;
};

const loadCartProductsForRead = async (cartId: number, supportedVariantFields: Set<any>) => {
  const rows = await CartItem.findAll({
    where: { cartId },
    attributes: buildCartItemQueryAttributes(supportedVariantFields),
    include: [
      {
        model: Product,
        attributes: [
          "id",
          "name",
          "slug",
          "sku",
          "price",
          "salePrice",
          "promoImagePath",
          "imagePaths",
          "storeId",
          "stock",
        ],
        required: true,
      },
    ],
    order: [["id", "ASC"]],
  });

  return rows
    .map((row: any) => buildCartReadProductSnapshot(row?.Product ?? row?.product ?? null, row))
    .filter(Boolean);
};

const resolveRequestedCartVariant = (product: any, body: Record<string, any>) => {
  const variationState = normalizeProductVariationState(getAttr(product, "variations"));
  if (!variationState.hasVariants) return null;
  const productId = Number(getAttr(product, "id") ?? product?.id ?? 0) || null;

  const rawVariantKey = String(body?.variantKey || "").trim();
  const rawSelections = Array.isArray(body?.variantSelections) ? body.variantSelections : [];
  const normalizedSelections = rawSelections
    .map((selection: any) => {
      const attributeId = Number(selection?.attributeId);
      const attributeName = String(selection?.attributeName || "").trim();
      const value = String(selection?.value || "").trim();
      if (!Number.isInteger(attributeId) || attributeId <= 0 || !value) return null;
      return {
        attributeId,
        attributeName,
        valueId: selection?.valueId ?? null,
        value,
      };
    })
    .filter(Boolean);
  const resolvedVariantKey =
    rawVariantKey || (normalizedSelections.length > 0 ? buildVariantCombinationKey(normalizedSelections) : "");

  if (!resolvedVariantKey) {
    throw createControllerError("Choose a variant before adding this product to the cart.", {
      statusCode: 409,
      code: "PRODUCT_VARIANT_REQUIRED",
      meta: {
        productId,
      },
    });
  }

  const variant =
    variationState.variants.find(
      (entry: any) => String(entry?.combinationKey || "").trim() === resolvedVariantKey
    ) || null;
  if (!variant) {
    throw createControllerError("This variant is no longer available. Choose another variant.", {
      statusCode: 409,
      code: "VARIANT_NOT_AVAILABLE",
      meta: {
        productId,
        variantKey: resolvedVariantKey,
        variantSelections: normalizedSelections,
      },
    });
  }
  return variant;
};

const buildCartLineSnapshot = (product: any, variant: any) => {
  const productPrice = Number(getAttr(product, "price") ?? 0) || 0;
  const productSalePrice = Number(getAttr(product, "salePrice") ?? 0) || 0;
  const productSku = String(getAttr(product, "sku") || "").trim() || null;
  const productBarcode = String(getAttr(product, "barcode") || "").trim() || null;
  const productImage = getProductPrimaryImage(product);

  return {
    variantKey: variant?.combinationKey ? String(variant.combinationKey).trim() : null,
    variantLabel: variant?.combination ? String(variant.combination).trim() : null,
    variantSelections: Array.isArray(variant?.selections) ? variant.selections : null,
    variantSkuSnapshot: variant?.sku ? String(variant.sku).trim() : productSku,
    variantBarcodeSnapshot: variant?.barcode ? String(variant.barcode).trim() : productBarcode,
    unitPriceSnapshot:
      variant?.price === null || typeof variant?.price === "undefined" ? productPrice : Number(variant.price),
    unitSalePriceSnapshot:
      variant?.salePrice === null || typeof variant?.salePrice === "undefined"
        ? variant?.price === null || typeof variant?.price === "undefined"
          ? productSalePrice > 0
            ? productSalePrice
            : productPrice
          : Number(variant.price)
        : Number(variant.salePrice),
    variantImageSnapshot: normalizeUploadsUrl(variant?.image || productImage),
    stockSnapshot:
      variant?.quantity === null || typeof variant?.quantity === "undefined"
        ? Number(getAttr(product, "stock") ?? 0)
        : Number(variant.quantity),
  };
};

const resolveCartItemLookup = async (
  cartId: number,
  idOrProductId: number,
  transaction?: any,
  supportedFields?: Set<keyof typeof CART_ITEM_VARIANT_FIELD_COLUMN_MAP>,
  options?: {
    strictItemId?: boolean;
  }
) => {
  const queryAttributes = buildCartItemQueryAttributes(
    supportedFields ?? (await getCartItemSupportedVariantFields())
  );
  const byItemId = await CartItem.findOne({
    where: { cartId, id: idOrProductId },
    attributes: queryAttributes,
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (byItemId) {
    return {
      cartItem: byItemId,
      resolvedProductId: Number(getAttr(byItemId, "productId") ?? 0),
      lookupMode: "itemId",
    };
  }

  if (options?.strictItemId) {
    return {
      cartItem: null,
      resolvedProductId: 0,
      lookupMode: null,
    };
  }

  const byProductId = await CartItem.findOne({
    where: { cartId, productId: idOrProductId },
    attributes: queryAttributes,
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (byProductId) {
    return {
      cartItem: byProductId,
      resolvedProductId: Number(getAttr(byProductId, "productId") ?? 0),
      lookupMode: "productId",
    };
  }

  return {
    cartItem: null,
    resolvedProductId: idOrProductId,
    lookupMode: null,
  };
};

const isStorefrontCartEligible = (product: any) => {
  const status = String(getAttr(product, "status") || "").trim().toLowerCase();
  const isPublished = Boolean(
    getAttr(product, "isPublished") ?? getAttr(product, "published")
  );
  const submissionStatus = String(getAttr(product, "sellerSubmissionStatus") || "none")
    .trim()
    .toLowerCase();
  const storeId = Number(getAttr(product, "storeId") ?? product?.storeId ?? 0);
  const store = product?.store ?? product?.get?.("store") ?? null;
  const operationalReadiness = store ? buildPublicStoreOperationalReadiness(store) : null;
  return (
    status === "active" &&
    isPublished &&
    submissionStatus === "none" &&
    Number.isFinite(storeId) &&
    storeId > 0 &&
    Boolean(operationalReadiness?.isReady)
  );
};

const loadOperationalStoreSnapshot = async (storeId: number, transaction?: any) =>
  Store.findByPk(storeId, {
    attributes: ["id", "status", "activeStorePaymentProfileId"],
    include: [
      {
        association: "paymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
      {
        association: "activePaymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
    ],
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

const loadCartProductForMutation = async (
  productId: number,
  transaction?: any
) => {
  const product = await Product.findByPk(productId, {
    attributes: [
      "id",
      "name",
      "sku",
      "barcode",
      "price",
      "salePrice",
      "stock",
      "status",
      "isPublished",
      "sellerSubmissionStatus",
      "storeId",
      "promoImagePath",
      "imagePaths",
      "variations",
    ],
    include: [
      {
        model: Store,
        as: "store",
        attributes: ["id", "status", "activeStorePaymentProfileId"],
        include: [
          {
            association: "paymentProfile",
            attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
            required: false,
          },
          {
            association: "activePaymentProfile",
            attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
            required: false,
          },
        ],
        required: false,
      },
    ],
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  const storeId = Number(getAttr(product, "storeId") ?? product?.storeId ?? 0);
  if (product && Number.isFinite(storeId) && storeId > 0) {
    const store = await loadOperationalStoreSnapshot(storeId, transaction);
    if (store) {
      (product as any).setDataValue?.("store", store);
      (product as any).store = store;
    }
  }
  return product;
};

const validateCartMutationProduct = (
  product: any,
  requestedQty: number,
  snapshot?: {
    stockSnapshot?: number | null;
    variantKey?: string | null;
    variantLabel?: string | null;
  }
) => {
  const productId = Number(getAttr(product, "id") ?? product?.id ?? 0) || null;
  if (!product) {
    throw createControllerError("Product not found.", {
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
      meta: {
        productId,
      },
    });
  }

  if (!isStorefrontCartEligible(product)) {
    throw createControllerError("This product is no longer available for purchase.", {
      statusCode: 409,
      code: "PRODUCT_NOT_AVAILABLE",
      meta: {
        productId,
        variantKey: snapshot?.variantKey ?? null,
        variantLabel: snapshot?.variantLabel ?? null,
      },
    });
  }

  const stock = Number(snapshot?.stockSnapshot ?? getAttr(product, "stock") ?? 0);
  if (!Number.isFinite(stock) || stock < requestedQty) {
    const availableStock = Math.max(0, Number.isFinite(stock) ? stock : 0);
    throw createControllerError(
      availableStock <= 0
        ? "This product is currently out of stock."
        : `Stock changed. Reduce the quantity to ${availableStock} and try again.`,
      {
        statusCode: 409,
        code: availableStock <= 0 ? "PRODUCT_OUT_OF_STOCK" : "PRODUCT_STOCK_REDUCED",
        meta: {
          productId,
          variantKey: snapshot?.variantKey ?? null,
          variantLabel: snapshot?.variantLabel ?? null,
          availableStock,
          requestedQty,
        },
      }
    );
  }
};

// --- CONTROLLER FUNCTIONS ---

export const addToCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, any>;
    const { productId, quantity = 1 }: { productId: number; quantity: number } = body as any;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!productId) {
      res.status(400).json({ message: "Product ID is required." });
      return;
    }
    let responsePayload: any = null;

    await sequelize.transaction(async (t) => {
      const supportedVariantFields = await getCartItemSupportedVariantFields();
      let cart = await Cart.findOne({
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!cart) {
        cart = await Cart.create({ userId }, { transaction: t });
      }
      const cartId = await resolveCartId(cart, userId);
      if (!cartId) {
        throw new Error("Failed to resolve cart id.");
      }

      const product = await loadCartProductForMutation(Number(productId), t);
      const requestedVariant = resolveRequestedCartVariant(product, body);
      const snapshot = buildCartLineSnapshot(product, requestedVariant);
      const existingItem = await CartItem.findOne({
        where: buildCartItemLookupWhere(
          cartId,
          productId,
          snapshot.variantKey,
          supportedVariantFields
        ),
        attributes: buildCartItemQueryAttributes(supportedVariantFields),
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const currentQty = Number(getAttr(existingItem, "quantity") ?? 0);
      const nextQty = currentQty + Math.max(1, Number(quantity) || 1);
      validateCartMutationProduct(product, nextQty, snapshot);

      if (existingItem) {
        existingItem.set("quantity", nextQty);
        const supportedSnapshotFields = buildSupportedCartItemSnapshotFields(
          snapshot,
          supportedVariantFields
        );
        Object.entries(supportedSnapshotFields).forEach(([field, value]) => {
          existingItem.setDataValue(field as any, value);
        });
        await existingItem.save({ transaction: t });
        responsePayload = toCartItemPayload(existingItem);
        return;
      }

      const created = await CartItem.create(
        {
          quantity: Math.max(1, Number(quantity) || 1),
          productId: productId,
          cartId,
          ...buildSupportedCartItemSnapshotFields(snapshot, supportedVariantFields),
        },
        { transaction: t }
      );
      responsePayload = toCartItemPayload(created);
    });

    res.status(200).json({
      message: "Product added to cart successfully.",
      cartItem: responsePayload,
    });
  } catch (error) {
    console.error("ADD TO CART ERROR:", error);
    sendControllerError(res, error, "Failed to add product to cart.");
  }
};

export const getCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const supportedVariantFields = await getCartItemSupportedVariantFields();
    const cart = await Cart.findOne({
      where: { userId },
      attributes: ["id", "userId"],
    });

    if (!cart) {
      res.status(200).json({ id: null, userId, Products: [] });
      return;
    }

    const cartId = await resolveCartId(cart, userId);
    const products = cartId
      ? await loadCartProductsForRead(cartId, supportedVariantFields)
      : [];

    res.status(200).json({
      id: getAttr(cart, "id"),
      userId: getAttr(cart, "userId"),
      Products: products,
    });
  } catch (error) {
    console.error("GET CART ERROR:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch cart.",
        error: (error as Error).message,
      });
  }
};

export const removeFromCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const id = toId((req.params as any).productId ?? (req.params as any).itemId);
    if (id === null) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const cart = await Cart.findOne({ where: { userId } });
    if (!cart) {
      res.status(404).json({ message: "Cart not found." });
      return;
    }
    const cartId = await resolveCartId(cart, userId);
    if (!cartId) {
      res.status(500).json({ message: "Failed to resolve cart id." });
      return;
    }
    const strictItemIdLookup = String((req.route as any)?.path || "").includes("/by-id/");

    const resolved = await resolveCartItemLookup(
      cartId,
      id,
      undefined,
      await getCartItemSupportedVariantFields(),
      { strictItemId: strictItemIdLookup }
    );
    if (!resolved.cartItem) {
      res.status(404).json({ message: "Item not found in cart." });
      return;
    }

    await resolved.cartItem.destroy();

    res.status(200).json({ message: "Item removed from cart successfully." });
  } catch (error) {
    console.error("REMOVE FROM CART ERROR:", error);
    res
      .status(500)
      .json({
        message: "Failed to remove item from cart.",
        error: (error as Error).message,
      });
  }
};

export const updateCartItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const id = toId(req.params.productId);
    if (id === null) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }
    const { quantity }: { quantity: number } = req.body;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (quantity === undefined || quantity < 0) {
      res.status(400).json({ message: "Invalid quantity provided." });
      return;
    }

    await sequelize.transaction(async (t) => {
      const cart = await Cart.findOne({
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!cart) {
        const error: any = new Error("Cart not found.");
        error.statusCode = 404;
        throw error;
      }
      const cartId = await resolveCartId(cart, userId);
      if (!cartId) {
        throw new Error("Failed to resolve cart id.");
      }

      if (quantity === 0) {
        await CartItem.destroy({
          where: { cartId, productId: id },
          transaction: t,
        });
        return;
      }

      const product = await loadCartProductForMutation(id, t);
      validateCartMutationProduct(product, quantity);

      await CartItem.update(
        { quantity },
        {
          where: { cartId, productId: id },
          transaction: t,
        }
      );
    });

    res.status(200).json({ message: "Cart updated successfully." });
  } catch (error) {
    console.error("UPDATE CART ERROR:", error);
    sendControllerError(res, error, "Failed to update cart.");
  }
};

export const setCartItemQty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const targetId = toId((req.params as any).itemId ?? req.params.productId);
    const qty = toQty((req.body as any)?.qty ?? (req.body as any)?.quantity);

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!targetId || targetId <= 0 || !Number.isInteger(targetId)) {
      res.status(400).json({ message: "Invalid cart target id" });
      return;
    }

    if (qty === null) {
      res.status(400).json({ message: "Invalid qty" });
      return;
    }

    const strictItemIdLookup = String((req.route as any)?.path || "").includes("/by-id/");

    await sequelize.transaction(async (t) => {
      const supportedVariantFields = await getCartItemSupportedVariantFields();
      let cart = await Cart.findOne({
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!cart) {
        if (qty <= 0 || strictItemIdLookup) {
          const error: any = new Error("Item not found in cart.");
          error.statusCode = 404;
          throw error;
        }
        cart = await Cart.create({ userId }, { transaction: t });
      }
      const cartId = await resolveCartId(cart, userId);
      if (!cartId) {
        throw new Error("Failed to resolve cart id.");
      }

      const resolved = await resolveCartItemLookup(
        cartId,
        targetId,
        t,
        supportedVariantFields,
        { strictItemId: strictItemIdLookup }
      );
      const cartItem = resolved.cartItem;

      if (qty <= 0) {
        if (cartItem) {
          await cartItem.destroy({ transaction: t });
        }
        return;
      }

      if (strictItemIdLookup && !cartItem) {
        const error: any = new Error("Item not found in cart.");
        error.statusCode = 404;
        throw error;
      }

      const product = await loadCartProductForMutation(resolved.resolvedProductId, t);
      const variationState = normalizeProductVariationState(getAttr(product, "variations"));
      const persistedVariantKey = String(getAttr(cartItem, "variantKey") || "").trim() || null;
      const persistedVariantSelections = normalizeJsonValue(getAttr(cartItem, "variantSelections"));
      if (
        cartItem &&
        variationState.hasVariants &&
        !persistedVariantKey &&
        (!Array.isArray(persistedVariantSelections) || persistedVariantSelections.length === 0)
      ) {
        throw createControllerError(
          "This cart line has lost its variant selection. Remove it and add the product again.",
          {
            statusCode: 409,
            code: "PRODUCT_VARIANT_MISSING",
            meta: {
              productId: resolved.resolvedProductId,
              cartItemId: Number(getAttr(cartItem, "id") ?? 0) || null,
            },
          }
        );
      }
      const lineStockSnapshot =
        cartItem &&
        supportedVariantFields.has("variantKey") &&
        persistedVariantKey
          ? buildCartLineSnapshot(
              product,
              resolveRequestedCartVariant(product, {
                variantKey: persistedVariantKey,
                variantSelections: Array.isArray(persistedVariantSelections)
                  ? persistedVariantSelections
                  : [],
              })
            ).stockSnapshot
          : Number(getAttr(product, "stock") ?? 0);
      validateCartMutationProduct(product, qty, {
        stockSnapshot: lineStockSnapshot,
        variantKey: persistedVariantKey,
        variantLabel: String(getAttr(cartItem, "variantLabel") || "").trim() || null,
      });

      if (cartItem) {
        const currentQty = Number(getAttr(cartItem, "quantity") ?? 0);
        if (currentQty !== qty) {
          cartItem.set("quantity", qty);
          await cartItem.save({ transaction: t });
        }
        return;
      }

      const initialVariant = resolveRequestedCartVariant(product, req.body as any);
      const initialSnapshot = buildCartLineSnapshot(product, initialVariant);
      await CartItem.create(
        {
          cartId,
          productId: resolved.resolvedProductId,
          quantity: qty,
          ...buildSupportedCartItemSnapshotFields(initialSnapshot, supportedVariantFields),
        },
        { transaction: t }
      );
    });

    res.status(200).json({ message: "Cart updated successfully." });
  } catch (error) {
    console.error("SET CART ITEM QTY ERROR:", error);
    sendControllerError(res, error, "Failed to set cart item quantity.");
  }
};


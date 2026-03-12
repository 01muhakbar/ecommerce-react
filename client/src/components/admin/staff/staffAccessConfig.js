export const STAFF_IMAGE_UPLOAD_GUIDANCE = {
  formats: "JPG, PNG, or WEBP",
  recommendedSize: "800 x 800 px",
  minimumSize: "600 x 600 px",
  aspectRatio: "1:1 square",
  maxSize: "2 MB",
};

export const SELLER_PERMISSION_GROUPS = [
  {
    id: "store",
    title: "Store workspace",
    permissions: [
      { value: "STORE_VIEW", label: "Store dashboard" },
      { value: "STORE_EDIT", label: "Store profile" },
      { value: "STOREFRONT_VIEW", label: "Storefront visibility" },
    ],
  },
  {
    id: "catalog",
    title: "Catalog",
    permissions: [
      { value: "PRODUCT_VIEW", label: "Products view" },
      { value: "PRODUCT_CREATE", label: "Products create" },
      { value: "PRODUCT_EDIT", label: "Products edit" },
      { value: "PRODUCT_MEDIA_MANAGE", label: "Media manage" },
      { value: "INVENTORY_VIEW", label: "Inventory view" },
      { value: "INVENTORY_MANAGE", label: "Inventory manage" },
    ],
  },
  {
    id: "orders",
    title: "Orders",
    permissions: [
      { value: "ORDER_VIEW", label: "Orders view" },
      { value: "ORDER_FULFILLMENT_MANAGE", label: "Fulfillment manage" },
      { value: "PAYMENT_STATUS_VIEW", label: "Payment review" },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    permissions: [{ value: "PAYMENT_PROFILE_VIEW", label: "Payment profile view" }],
  },
];

export const SELLER_ROLE_PRESETS = [
  {
    value: "CATALOG_MANAGER",
    label: "Seller Catalog Manager",
    description: "Catalog-first access for draft authoring, media, and stock operations.",
    permissionKeys: [
      "STORE_VIEW",
      "PRODUCT_VIEW",
      "PRODUCT_CREATE",
      "PRODUCT_EDIT",
      "PRODUCT_MEDIA_MANAGE",
      "INVENTORY_VIEW",
      "INVENTORY_MANAGE",
    ],
  },
  {
    value: "ORDER_MANAGER",
    label: "Seller Order Manager",
    description: "Operational access for seller orders, fulfillment, and payment review visibility.",
    permissionKeys: ["STORE_VIEW", "ORDER_VIEW", "ORDER_FULFILLMENT_MANAGE", "PAYMENT_STATUS_VIEW"],
  },
  {
    value: "FINANCE_VIEWER",
    label: "Seller Finance Viewer",
    description: "Read-focused access for payment profile and payment status visibility.",
    permissionKeys: ["STORE_VIEW", "ORDER_VIEW", "PAYMENT_PROFILE_VIEW", "PAYMENT_STATUS_VIEW"],
  },
  {
    value: "CONTENT_MANAGER",
    label: "Seller Store Editor",
    description: "Store-profile access for seller-facing content and storefront context.",
    permissionKeys: ["STORE_VIEW", "STORE_EDIT", "STOREFRONT_VIEW"],
  },
];

export const getSellerPreset = (roleCode) =>
  SELLER_ROLE_PRESETS.find((preset) => preset.value === roleCode) || SELLER_ROLE_PRESETS[0];

export const normalizePermissionKeys = (input) => {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((entry) => String(entry || "").trim()).filter(Boolean))];
};

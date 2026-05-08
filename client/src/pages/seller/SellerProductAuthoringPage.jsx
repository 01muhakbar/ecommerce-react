import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Package,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Tag,
  Upload,
  X,
} from "lucide-react";
import {
  createSellerProductDraft,
  getSellerProductAuthoringMeta,
  getSellerProductDetail,
  setSellerProductPublished,
  submitSellerProductDraftForReview,
  uploadSellerProductImage,
  updateSellerProductDraft,
} from "../../api/sellerProducts.ts";
import {
  getSellerAttributes,
  getSellerAttributeValues,
} from "../../api/sellerAttributes.ts";
import {
  sellerDisabledFieldClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceNotice,
  SellerWorkspaceStatePanel,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import { buildCategoryTree } from "../../utils/categoryTree.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const emptyToNull = (value) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const normalizeSelectedCategoryIds = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => Number(entry))
        .filter((entry) => Number.isInteger(entry) && entry > 0),
    ),
  );

const resolveDefaultCategoryId = (categoryIds, currentDefaultCategoryId) => {
  const normalizedIds = normalizeSelectedCategoryIds(categoryIds);
  const normalizedDefault = Number(currentDefaultCategoryId);

  if (normalizedIds.length === 0) return "";
  if (
    Number.isInteger(normalizedDefault) &&
    normalizedIds.includes(normalizedDefault)
  ) {
    return String(normalizedDefault);
  }
  return String(normalizedIds[0]);
};

const normalizeCategorySearchValue = (value) =>
  String(value || "").trim().toLowerCase();

const defaultSeoState = {
  metaTitle: "",
  metaDescription: "",
  keywords: [],
  ogImageUrl: "",
};

const normalizeSeoState = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSeoState;
  }

  const keywords = Array.isArray(value?.keywords)
    ? value.keywords
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .filter(
          (entry, index, list) =>
            list.findIndex((candidate) => candidate.toLowerCase() === entry.toLowerCase()) ===
            index,
        )
    : [];

  return {
    metaTitle: String(value?.metaTitle || "").trim(),
    metaDescription: String(value?.metaDescription || "").trim(),
    keywords,
    ogImageUrl: String(value?.ogImageUrl || "").trim(),
  };
};

const isLikelySeoImageUrl = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return true;
  return /^https?:\/\//i.test(normalized) || normalized.startsWith("/");
};

const filterCategoryTree = (nodes, query) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  if (!query) return nodes;

  return nodes.reduce((accumulator, node) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    const filteredChildren = filterCategoryTree(children, query);
    const haystack = `${node?.name || ""} ${node?.code || ""}`.toLowerCase();
    const nodeMatches = haystack.includes(query);

    if (nodeMatches) {
      accumulator.push({
        ...node,
        children,
      });
      return accumulator;
    }

    if (filteredChildren.length > 0) {
      accumulator.push({
        ...node,
        children: filteredChildren,
      });
    }

    return accumulator;
  }, []);
};

const createEmptyForm = () => ({
  name: "",
  description: "",
  sku: "",
  barcode: "",
  slug: "",
  categoryIds: [],
  defaultCategoryId: "",
  price: "0",
  salePrice: "",
  stock: "0",
  imageUrls: [],
  tags: [],
});

const defaultVariationEditorState = {
  hasVariants: false,
  selectedAttributes: [],
  selectedAttributeValues: [],
  variants: [],
};

const resolveSalePriceValue = (value) =>
  String(value ?? "").trim() === "" ? null : Number(value);

const normalizeVariantNumber = (value) => {
  if (value === null || typeof value === "undefined" || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeVariantQuantity = (value) => {
  if (value === null || typeof value === "undefined" || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
};

const normalizeVariantAttributeKey = (value, attributeId) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return normalized || `attribute-${Number(attributeId) || 0}`;
};

const buildVariantCombination = (selections) =>
  selections
    .map((entry) => {
      const attributeName = String(entry?.attributeName || "").trim();
      const value = String(entry?.label ?? entry?.value ?? "").trim();
      if (!attributeName || !value) return "";
      return `${attributeName}: ${value}`;
    })
    .filter(Boolean)
    .join(" / ");

const buildVariantCombinationKey = (selections) =>
  selections
    .map((entry) => {
      const attributeKey = normalizeVariantAttributeKey(
        entry?.attributeName,
        entry?.attributeId,
      );
      const value = String(entry?.label ?? entry?.value ?? "").trim();
      return attributeKey && value ? `${attributeKey}:${value}` : "";
    })
    .filter(Boolean)
    .join("|");

const buildCartesianProduct = (attributesWithValues) => {
  if (!Array.isArray(attributesWithValues) || attributesWithValues.length === 0) {
    return [];
  }

  return attributesWithValues.reduce(
    (accumulator, attributeGroup) => {
      const next = [];
      accumulator.forEach((prefix) => {
        attributeGroup.values.forEach((value) => {
          next.push([
            ...prefix,
            {
              attributeId: attributeGroup.attribute.id,
              attributeName: attributeGroup.attribute.name,
              valueId: value.id ?? null,
              value: value.value,
              label: value.label ?? value.value,
            },
          ]);
        });
      });
      return next;
    },
    [[]],
  );
};

const normalizeVariationEditorState = (value) => {
  if (!value) return defaultVariationEditorState;

  if (typeof value === "string") {
    try {
      return normalizeVariationEditorState(JSON.parse(value));
    } catch {
      return defaultVariationEditorState;
    }
  }

  const raw =
    Array.isArray(value) ? { hasVariants: value.length > 0, variants: value } : value;
  const selectedAttributesMap = new Map();
  const selectedAttributeValuesMap = new Map();

  (Array.isArray(raw?.selectedAttributes) ? raw.selectedAttributes : []).forEach((entry) => {
    const id = Number(entry?.id);
    const name = String(entry?.name || "").trim();
    if (Number.isInteger(id) && id > 0 && name) {
      selectedAttributesMap.set(id, { id, name });
    }
  });

  (
    Array.isArray(raw?.selectedAttributeValues) ? raw.selectedAttributeValues : []
  ).forEach((entry) => {
    const attributeId = Number(entry?.attributeId);
    if (!Number.isInteger(attributeId) || attributeId <= 0) return;
    const values = Array.isArray(entry?.values)
      ? entry.values
          .map((item) => {
            const valueText = String(item?.value ?? item?.label ?? "").trim();
            if (!valueText) return null;
            return {
              id: item?.id ?? null,
              label: String(item?.label ?? valueText).trim(),
              value: valueText,
            };
          })
          .filter(Boolean)
      : [];

    selectedAttributeValuesMap.set(attributeId, {
      attributeId,
      values,
    });
  });

  const variants = (Array.isArray(raw?.variants) ? raw.variants : [])
    .map((entry, index) => {
      const selections = Array.isArray(entry?.selections)
        ? entry.selections
            .map((selection) => {
              const attributeId = Number(selection?.attributeId);
              const attributeName = String(selection?.attributeName || "").trim();
              const value = String(selection?.value || "").trim();
              if (
                !Number.isInteger(attributeId) ||
                attributeId <= 0 ||
                !attributeName ||
                !value
              ) {
                return null;
              }

              const valueId = selection?.valueId ?? null;
              selectedAttributesMap.set(attributeId, { id: attributeId, name: attributeName });
              const existing = selectedAttributeValuesMap.get(attributeId) || {
                attributeId,
                values: [],
              };
              const dedupeKey = String(valueId ?? value).toLowerCase();
              if (
                !existing.values.some(
                  (item) => String(item.id ?? item.value).toLowerCase() === dedupeKey,
                )
              ) {
                existing.values.push({
                  id: valueId,
                  label: value,
                  value,
                });
              }
              selectedAttributeValuesMap.set(attributeId, existing);

              return {
                attributeId,
                attributeName,
                valueId,
                value,
              };
            })
            .filter(Boolean)
        : [];

      const combination = buildVariantCombination(selections);
      const combinationKey = buildVariantCombinationKey(selections);
      if (!combination || !combinationKey) return null;

      return {
        id: String(entry?.id || `variant-${index + 1}`),
        combination,
        combinationKey,
        selections,
        sku: String(entry?.sku || "").trim(),
        barcode: String(entry?.barcode || "").trim(),
        price: normalizeVariantNumber(entry?.price),
        salePrice: normalizeVariantNumber(entry?.salePrice),
        quantity: normalizeVariantQuantity(entry?.quantity ?? entry?.stock),
        image: entry?.image ? String(entry.image) : null,
      };
    })
    .filter(Boolean);

  return {
    hasVariants: Boolean(raw?.hasVariants) || variants.length > 0,
    selectedAttributes: Array.from(selectedAttributesMap.values()),
    selectedAttributeValues: Array.from(selectedAttributeValuesMap.values()),
    variants,
  };
};

const createFormFromMeta = (meta) => ({
  name: meta?.draftDefaults?.name || "",
  description: meta?.draftDefaults?.description || "",
  sku: meta?.draftDefaults?.sku || "",
  barcode: meta?.draftDefaults?.barcode || "",
  slug: meta?.draftDefaults?.slug || "",
  categoryIds: normalizeSelectedCategoryIds(meta?.draftDefaults?.categoryIds),
  defaultCategoryId: resolveDefaultCategoryId(
    meta?.draftDefaults?.categoryIds,
    meta?.draftDefaults?.defaultCategoryId,
  ),
  price: String(meta?.draftDefaults?.price ?? 0),
  salePrice:
    meta?.draftDefaults?.salePrice == null
      ? ""
      : String(meta.draftDefaults.salePrice),
  stock: String(meta?.draftDefaults?.stock ?? 0),
  imageUrls: Array.isArray(meta?.draftDefaults?.imageUrls)
    ? meta.draftDefaults.imageUrls
    : [],
  tags: Array.isArray(meta?.draftDefaults?.tags) ? meta.draftDefaults.tags : [],
});

const createSeoFromMeta = (meta) => normalizeSeoState(meta?.draftDefaults?.seo);

const createFormFromProduct = (product) => ({
  name: product?.name || "",
  description: product?.descriptions?.description || "",
  sku: product?.sku || "",
  barcode: product?.attributes?.barcode || "",
  slug: product?.slug || "",
  categoryIds: normalizeSelectedCategoryIds(
    Array.isArray(product?.category?.assigned)
      ? product.category.assigned.map((category) => Number(category?.id || 0))
      : [],
  ),
  defaultCategoryId: resolveDefaultCategoryId(
    Array.isArray(product?.category?.assigned)
      ? product.category.assigned.map((category) => Number(category?.id || 0))
      : [],
    product?.category?.default?.id,
  ),
  price: String(product?.pricing?.price ?? 0),
  salePrice:
    product?.pricing?.salePrice == null
      ? ""
      : String(product.pricing.salePrice),
  stock: String(product?.inventory?.stock ?? 0),
  imageUrls: Array.isArray(product?.media?.imageUrls)
    ? product.media.imageUrls
    : [],
  tags: Array.isArray(product?.attributes?.tags) ? product.attributes.tags : [],
});

const createSeoFromProduct = (product) => normalizeSeoState(product?.seo);

function SellerCategoryTree({
  tree = [],
  selectedIds = [],
  defaultCategoryId = "",
  onToggle,
  depth = 0,
}) {
  if (!Array.isArray(tree) || tree.length === 0) {
    return <p className="text-sm text-slate-500">No categories available.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {tree.map((node) => {
        const nodeId = Number(node?.id || 0);
        const isChecked = selectedIds.includes(nodeId);
        const hasChildren =
          Array.isArray(node?.children) && node.children.length > 0;

        return (
          <li
            key={`${nodeId}-${node?.slug || node?.name || "category"}`}
            className="space-y-1.5"
          >
            <label
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                isChecked
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(nodeId)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">
                  {node?.name || "Category"}
                </span>
              </span>
            </label>

            {hasChildren ? (
              <div className="ml-4 border-l border-slate-100 pl-2.5">
                <SellerCategoryTree
                  tree={node.children}
                  selectedIds={selectedIds}
                  defaultCategoryId={defaultCategoryId}
                  onToggle={onToggle}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const getAuthoringErrorMessage = (error, mode = "create") => {
  const code = String(error?.response?.data?.code || "")
    .trim()
    .toUpperCase();
  const message = String(error?.response?.data?.message || "").trim();
  const forbiddenFields = Array.isArray(error?.response?.data?.fields)
    ? error.response.data.fields
    : [];

  if (
    code === "SELLER_PRODUCT_AUTHORING_FORBIDDEN_FIELDS" &&
    forbiddenFields.length > 0
  ) {
    return `These fields are not editable in seller draft authoring: ${forbiddenFields.join(", ")}.`;
  }

  if (code === "SELLER_PRODUCT_DRAFT_REQUIRED") {
    return "Only draft products can be edited here.";
  }

  if (code === "SELLER_PRODUCT_SUBMISSION_LOCKED") {
    return "This draft is already with admin review, so editing is locked for now.";
  }

  if (code === "SELLER_PRODUCT_ALREADY_SUBMITTED") {
    return "This draft is already waiting in admin review.";
  }

  if (code === "SELLER_PRODUCT_NAME_REQUIRED") {
    return "Product name is required.";
  }

  if (code === "SELLER_PRODUCT_NAME_TOO_LONG") {
    return "Product name must be 255 characters or fewer.";
  }

  if (code === "SELLER_PRODUCT_SKU_TOO_LONG") {
    return "SKU must be 100 characters or fewer.";
  }

  if (code === "SELLER_PRODUCT_BARCODE_TOO_LONG") {
    return "Barcode must be 100 characters or fewer.";
  }

  if (code === "SELLER_PRODUCT_SLUG_INVALID") {
    return "Slug is invalid. Use letters, numbers, or hyphens only.";
  }

  if (code === "SELLER_PRODUCT_PRICE_INVALID") {
    return "Base price must be a valid non-negative number.";
  }

  if (code === "SELLER_PRODUCT_SALE_PRICE_INVALID") {
    return "Sale price must be a valid non-negative number.";
  }

  if (code === "SELLER_PRODUCT_SALE_PRICE_TOO_HIGH") {
    return "Sale price must stay lower than the base price.";
  }

  if (code === "SELLER_PRODUCT_STOCK_INVALID") {
    return "Stock must be a valid non-negative integer.";
  }

  if (code === "SELLER_PRODUCT_VARIANTS_REQUIRED") {
    return "Generate at least one variant combination before saving.";
  }

  if (code === "SELLER_PRODUCT_VARIATIONS_FLAG_INVALID") {
    return "Variant toggle must be a valid boolean value.";
  }

  if (code === "SELLER_PRODUCT_VARIATIONS_INVALID") {
    return "Variant payload is invalid.";
  }

  if (code === "SELLER_PRODUCT_VARIANT_DUPLICATE") {
    return message || "Duplicate variant combinations are not allowed.";
  }

  if (code === "SELLER_PRODUCT_VARIANT_SELECTIONS_REQUIRED") {
    return "Every variant row must contain attribute selections.";
  }

  if (code === "SELLER_PRODUCT_VARIANT_COMBINATION_INVALID") {
    return "One or more variant combinations are invalid.";
  }

  if (code === "SELLER_PRODUCT_VARIANT_PRICE_INVALID") {
    return "Variant price must be a valid non-negative number.";
  }

  if (code === "SELLER_PRODUCT_VARIANT_SALE_PRICE_INVALID") {
    return "Variant sale price must be a valid non-negative number.";
  }

  if (code === "SELLER_PRODUCT_VARIANT_SALE_PRICE_TOO_HIGH") {
    return "Variant sale price must stay lower than the variant price.";
  }

  if (code === "SELLER_PRODUCT_VARIANT_STOCK_INVALID") {
    return "Variant quantity must be a valid non-negative integer.";
  }

  if (code === "SELLER_PRODUCT_IMAGES_INVALID") {
    return "Draft images must be provided as a valid image list.";
  }

  if (code === "SELLER_PRODUCT_IMAGES_LIMIT_EXCEEDED") {
    return "Seller draft media is limited to 6 images in this phase.";
  }

  if (code === "SELLER_PRODUCT_IMAGE_URL_INVALID") {
    return "One or more draft images are invalid. Use uploaded JPG or PNG assets only.";
  }

  if (code === "SELLER_PRODUCT_DEFAULT_CATEGORY_REQUIRED") {
    return "Choose a default category when categories are selected.";
  }

  if (
    code === "SELLER_PRODUCT_DEFAULT_CATEGORY_INVALID" ||
    code === "SELLER_PRODUCT_CATEGORY_INVALID"
  ) {
    return (
      message ||
      "Selected categories are no longer valid for seller draft authoring."
    );
  }

  return (
    message ||
    getSellerRequestErrorMessage(error, {
      permissionMessage:
        mode === "create"
          ? "Your current seller access does not include draft creation."
          : "Your current seller access does not include draft editing.",
      fallbackMessage:
        mode === "create"
          ? "Failed to create seller product draft."
          : "Failed to update seller product draft.",
    })
  );
};

const getPublishErrorMessage = (error) => {
  const code = String(error?.response?.data?.code || "")
    .trim()
    .toUpperCase();
  const message = String(error?.response?.data?.message || "").trim();
  const blockers = Array.isArray(error?.response?.data?.data?.blockers)
    ? error.response.data.data.blockers
    : [];

  if (code === "SELLER_PRODUCT_PUBLISH_NOT_READY" && blockers.length > 0) {
    return blockers
      .map((entry) => entry?.message)
      .filter(Boolean)
      .join(" ");
  }

  return (
    message ||
    getSellerRequestErrorMessage(error, {
      permissionMessage:
        "Your current seller access does not include publish control.",
      fallbackMessage: "Failed to update seller product visibility.",
    })
  );
};

const getSubmissionReason = (submission) =>
  submission?.reviewNote ||
  submission?.revisionReason ||
  submission?.revisionNote ||
  null;

const drawerToneClassMap = {
  slate: "border-slate-200 bg-white text-slate-600",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

const authoringFieldClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50";
const authoringTextareaClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50";
const authoringSelectClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50";
const authoringSurfaceClass =
  "rounded-[18px] border border-slate-200/70 bg-slate-50/45 p-3";
const authoringActionMutedClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const authoringActionPrimaryClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const authoringIconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 transition hover:bg-rose-100";

function AuthoringFormRow({ label, helper = null, children }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-5">
      <div className="pt-2">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AuthoringInlineField({ label, children }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[128px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AuthoringGridField({ label, children }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}

function ProductField({
  label,
  hint,
  icon: Icon = null,
  multiline = false,
  disabled = false,
  ...props
}) {
  const inputClasses = multiline ? authoringTextareaClass : authoringFieldClass;

  return (
    <AuthoringFormRow
      label={label}
      helper={hint}
    >
      {multiline ? (
        <textarea
          className={`${inputClasses} min-h-[132px] ${disabled ? sellerDisabledFieldClass : ""}`}
          disabled={disabled}
          {...props}
        />
      ) : (
        <input
          className={`${inputClasses} ${disabled ? sellerDisabledFieldClass : ""}`}
          disabled={disabled}
          {...props}
        />
      )}
    </AuthoringFormRow>
  );
}

function DrawerChip({ icon: Icon = null, label, tone = "slate" }) {
  const toneClass = drawerToneClassMap[tone] || drawerToneClassMap.slate;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </span>
  );
}

function FormSectionLabel({ eyebrow, title, description = null }) {
  return (
    <div className="space-y-1 border-b border-slate-100/90 pb-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
      {description ? (
        <p className="text-xs text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}

export default function SellerProductAuthoringPage({
  mode = "create",
  presentation = "page",
  onClose,
  onSuccess,
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { productId } = useParams();
  const {
    sellerContext,
    workspaceStoreId: storeId,
    workspaceRoutes,
  } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewProducts = permissionKeys.includes("PRODUCT_VIEW");
  const numericProductId = Number(productId);
  const isEditMode = mode === "edit";
  const isDrawerMode = presentation === "drawer";
  const hasValidProductId =
    Number.isInteger(numericProductId) && numericProductId > 0;

  const [form, setForm] = useState(createEmptyForm());
  const [status, setStatus] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [seoKeywordInput, setSeoKeywordInput] = useState("");
  const [seo, setSeo] = useState(defaultSeoState);
  const [slugTouched, setSlugTouched] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [activeTab, setActiveTab] = useState("basic");
  const [hasVariants, setHasVariants] = useState(false);
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [selectedAttributeValues, setSelectedAttributeValues] = useState([]);
  const [variants, setVariants] = useState([]);
  const [pendingAttributeId, setPendingAttributeId] = useState("");
  const [attributeSearch, setAttributeSearch] = useState("");
  const [attributeValueSearch, setAttributeValueSearch] = useState({});
  const [attributeValuesMap, setAttributeValuesMap] = useState({});
  const [attributeValuesLoading, setAttributeValuesLoading] = useState(false);
  const [variantImageUploadingId, setVariantImageUploadingId] = useState(null);

  const metaQuery = useQuery({
    queryKey: ["seller", "products", "authoring-meta", storeId],
    queryFn: () => getSellerProductAuthoringMeta(storeId),
    enabled: Boolean(storeId) && canViewProducts,
    retry: false,
  });

  const productQuery = useQuery({
    queryKey: ["seller", "products", "detail", storeId, productId],
    queryFn: () => getSellerProductDetail(storeId, productId),
    enabled:
      Boolean(storeId) && canViewProducts && isEditMode && hasValidProductId,
    retry: false,
  });

  const attributeReferenceQuery = useQuery({
    queryKey: ["seller", "attributes", "reference", storeId],
    queryFn: () =>
      getSellerAttributes(storeId, {
        page: 1,
        limit: 250,
      }),
    enabled: Boolean(storeId) && canViewProducts,
    retry: false,
  });

  useEffect(() => {
    if (!isEditMode && metaQuery.data) {
      setForm(createFormFromMeta(metaQuery.data));
      setSeo(createSeoFromMeta(metaQuery.data));
      setSeoKeywordInput("");
      setSlugTouched(false);
      setActiveTab("basic");
      setHasVariants(Boolean(metaQuery.data?.draftDefaults?.hasVariants));
      setSelectedAttributes([]);
      setSelectedAttributeValues([]);
      setVariants([]);
      setPendingAttributeId("");
      setAttributeSearch("");
      setAttributeValueSearch({});
      setAttributeValuesMap({});
    }
  }, [isEditMode, metaQuery.data]);

  useEffect(() => {
    if (isEditMode && productQuery.data) {
      const variationState = normalizeVariationEditorState(
        productQuery.data?.variations?.raw,
      );
      setForm(createFormFromProduct(productQuery.data));
      setSeo(createSeoFromProduct(productQuery.data));
      setSeoKeywordInput("");
      setSlugTouched(Boolean(productQuery.data?.slug));
      setActiveTab("basic");
      setHasVariants(
        typeof productQuery.data?.hasVariants === "boolean"
          ? productQuery.data.hasVariants
          : variationState.hasVariants,
      );
      setSelectedAttributes(variationState.selectedAttributes);
      setSelectedAttributeValues(variationState.selectedAttributeValues);
      setVariants(variationState.variants);
      setPendingAttributeId("");
      setAttributeSearch("");
      setAttributeValueSearch({});
      setAttributeValuesMap({});
    }
  }, [isEditMode, productQuery.data]);

  useEffect(() => {
    if (!hasVariants && activeTab === "combination") {
      setActiveTab("basic");
    }
  }, [activeTab, hasVariants]);

  const governance = useMemo(() => {
    if (isEditMode) {
      return (
        productQuery.data?.governance ?? metaQuery.data?.governance ?? null
      );
    }
    return metaQuery.data?.governance ?? null;
  }, [isEditMode, metaQuery.data, productQuery.data]);

  const authoringGovernance = governance?.authoring ?? null;
  const fieldGovernance = governance?.fieldGovernance ?? null;
  const submissionGovernance = governance?.submissionGovernance ?? null;
  const detailAuthoring = productQuery.data?.authoring ?? null;
  const publishing = productQuery.data?.publishing ?? null;
  const submission = productQuery.data?.submission ?? null;
  const attributes = useMemo(
    () => (Array.isArray(attributeReferenceQuery.data?.data) ? attributeReferenceQuery.data.data : []),
    [attributeReferenceQuery.data?.data],
  );
  const visibleTabs = useMemo(
    () => [
      { id: "basic", label: "Basic Info" },
      ...(hasVariants ? [{ id: "combination", label: "Combination" }] : []),
      { id: "seo", label: "SEO" },
    ],
    [hasVariants],
  );
  const availableAttributes = useMemo(() => {
    const selectedIds = new Set(selectedAttributes.map((entry) => Number(entry.id)));
    const keyword = String(attributeSearch || "").trim().toLowerCase();
    return attributes.filter((attribute) => {
      const id = Number(attribute?.id);
      if (!Number.isInteger(id) || selectedIds.has(id)) return false;
      const name = String(
        attribute?.displayName || attribute?.display_name || attribute?.name || "",
      )
        .trim()
        .toLowerCase();
      return keyword ? name.includes(keyword) : true;
    });
  }, [attributeSearch, attributes, selectedAttributes]);
  const selectedAttributesWithValues = useMemo(
    () =>
      selectedAttributes.map((attribute) => {
        const selectedEntry = selectedAttributeValues.find(
          (entry) => Number(entry.attributeId) === Number(attribute.id),
        );
        return {
          attribute,
          values: Array.isArray(selectedEntry?.values) ? selectedEntry.values : [],
        };
      }),
    [selectedAttributeValues, selectedAttributes],
  );
  const previewCombinations = useMemo(() => {
    if (selectedAttributesWithValues.length === 0) return [];
    if (selectedAttributesWithValues.some((entry) => entry.values.length === 0)) return [];
    return buildCartesianProduct(selectedAttributesWithValues);
  }, [selectedAttributesWithValues]);
  const canGenerateVariants = previewCombinations.length > 0;
  const generatedCombinationKeys = useMemo(
    () =>
      new Set(
        variants
          .map((entry) => String(entry?.combinationKey || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    [variants],
  );
  const seoPreview = useMemo(() => {
    const slugSource = String(form.slug || "").trim() || slugify(form.name || "product");
    const urlPath = slugSource ? `/product/${slugSource}` : "/product/your-product";
    return {
      title: String(seo.metaTitle || "").trim() || String(form.name || "").trim() || "Product title",
      description:
        String(seo.metaDescription || "").trim() ||
        String(form.description || "").trim() ||
        "Product description will appear here.",
      url: `yourstore.com${urlPath}`,
      image:
        String(seo.ogImageUrl || "").trim() ||
        (Array.isArray(form.imageUrls) ? form.imageUrls[0] || "" : ""),
    };
  }, [form.description, form.imageUrls, form.name, form.slug, seo]);
  const seoMetaTitleSoftWarning =
    String(seo.metaTitle || "").trim().length > 70
      ? "Recommended maximum is 70 characters."
      : "";
  const seoMetaDescriptionSoftWarning =
    String(seo.metaDescription || "").trim().length > 160
      ? "Recommended maximum is 160 characters."
      : "";
  const seoOgImageWarning = useMemo(() => {
    if (!seo.ogImageUrl) return "";
    return isLikelySeoImageUrl(seo.ogImageUrl)
      ? ""
      : "Use an absolute http(s) URL or a local path starting with /.";
  }, [seo.ogImageUrl]);
  const submissionReason = getSubmissionReason(submission);
  const categoryReference = metaQuery.data?.references?.categories || [];
  const categoryTree = useMemo(
    () => buildCategoryTree(categoryReference),
    [categoryReference],
  );
  const normalizedCategorySearch = useMemo(
    () => normalizeCategorySearchValue(categorySearch),
    [categorySearch],
  );
  const filteredCategoryTree = useMemo(
    () => filterCategoryTree(categoryTree, normalizedCategorySearch),
    [categoryTree, normalizedCategorySearch],
  );
  const selectedCategories = useMemo(
    () =>
      categoryReference.filter((category) =>
        Array.isArray(form.categoryIds)
          ? form.categoryIds.includes(Number(category.id))
          : false,
      ),
    [categoryReference, form.categoryIds],
  );
  const defaultCategoryOptions = selectedCategories;
  const canCreateDraft = Boolean(authoringGovernance?.canCreateDraft);
  const canEditDraft = Boolean(detailAuthoring?.canEditDraft);
  const canManagePublish = Boolean(governance?.canPublish);
  const canSubmitForReview = Boolean(
    isEditMode &&
    (submission?.canSubmit ||
      submission?.canResubmit ||
      submissionGovernance?.canSubmitWhenEnabled),
  );
  const isNeedsRevision = submission?.status === "needs_revision";
  const isBusy = metaQuery.isLoading || (isEditMode && productQuery.isLoading);
  const canManageMedia = Array.isArray(fieldGovernance?.sellerEditableNow)
    ? fieldGovernance.sellerEditableNow.includes("imageUrls")
    : false;
  const publishBlockers = Array.isArray(publishing?.blockedReasons)
    ? publishing.blockedReasons.filter((entry) => entry?.message)
    : [];
  const attributeOwnershipWarnings = Array.isArray(
    productQuery.data?.attributeOwnershipWarnings,
  )
    ? productQuery.data.attributeOwnershipWarnings.filter(Boolean)
    : [];
  const showPublishBlockers =
    publishBlockers.length > 0 &&
    Boolean(isEditMode ? !publishing?.canPublish || !publishing?.isReady : true);

  useEffect(() => {
    const missingAttributes = selectedAttributes.filter(
      (entry) => !Array.isArray(attributeValuesMap[entry.id]),
    );
    if (missingAttributes.length === 0 || !storeId) return undefined;

    let cancelled = false;
    setAttributeValuesLoading(true);

    Promise.all(
      missingAttributes.map(async (attribute) => {
        const response = await getSellerAttributeValues(storeId, attribute.id);
        const items = Array.isArray(response?.data) ? response.data : [];
        return [
          attribute.id,
          items.map((item) => ({
            id: item?.id ?? null,
            label: String(item?.value || "").trim(),
            value: String(item?.value || "").trim(),
          })),
        ];
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setAttributeValuesMap((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus({
          type: "error",
          message:
            error?.response?.data?.message || "Failed to load seller attribute values.",
        });
      })
      .finally(() => {
        if (!cancelled) setAttributeValuesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attributeValuesMap, selectedAttributes, storeId]);

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditMode
        ? updateSellerProductDraft(storeId, productId, payload)
        : createSellerProductDraft(storeId, payload),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "authoring-meta", storeId],
        }),
      ]);

      queryClient.setQueryData(
        ["seller", "products", "detail", storeId, data.id],
        data,
      );
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: getAuthoringErrorMessage(error, mode),
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitSellerProductDraftForReview(storeId, productId),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "authoring-meta", storeId],
        }),
      ]);
      queryClient.setQueryData(
        ["seller", "products", "detail", storeId, productId],
        data,
      );
      navigate(workspaceRoutes.productDetail(data.id), { replace: true });
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: getAuthoringErrorMessage(error, "edit"),
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ productId: targetProductId, published }) =>
      setSellerProductPublished(storeId, targetProductId, published),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "authoring-meta", storeId],
        }),
      ]);
      queryClient.setQueryData(
        ["seller", "products", "detail", storeId, data.id],
        data,
      );
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: getPublishErrorMessage(error),
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files) => {
      const uploadedUrls = await Promise.all(
        files.map((file) => uploadSellerProductImage(file)),
      );
      return uploadedUrls;
    },
    onSuccess: (uploadedUrls) => {
      setUploadStatus({
        type: "success",
        message:
          uploadedUrls.length === 1
            ? "Image uploaded to draft media staging."
            : `${uploadedUrls.length} images uploaded to draft media staging.`,
      });
      setForm((current) => ({
        ...current,
        imageUrls: Array.from(
          new Set([...(current.imageUrls || []), ...uploadedUrls]),
        ).slice(0, 6),
      }));
    },
    onError: (error) => {
      setUploadStatus({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to upload seller draft image.",
      });
    },
  });

  const handleChange = (key) => (event) => {
    const nextValue = event?.target?.value ?? "";
    setForm((current) => ({ ...current, [key]: nextValue }));
  };

  const handleNameChange = (event) => {
    const nextValue = event?.target?.value ?? "";
    setForm((current) => ({
      ...current,
      name: nextValue,
      slug: slugTouched ? current.slug : slugify(nextValue),
    }));
  };

  const handleSlugChange = (event) => {
    const nextValue = slugify(event?.target?.value ?? "");
    setSlugTouched(true);
    setForm((current) => ({ ...current, slug: nextValue }));
  };

  const handleTagKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = String(tagInput || "").trim();
    if (!value) return;

    setForm((current) => {
      const exists = current.tags.some(
        (entry) => entry.toLowerCase() === value.toLowerCase(),
      );
      if (exists) return current;
      return { ...current, tags: [...current.tags, value] };
    });
    setTagInput("");
  };

  const handleRemoveTag = (tag) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((entry) => entry !== tag),
    }));
  };

  const handleSeoKeywordKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = String(seoKeywordInput || "").trim();
    if (!value) return;

    setSeo((current) => {
      if (
        current.keywords.some(
          (keyword) => keyword.toLowerCase() === value.toLowerCase(),
        )
      ) {
        return current;
      }
      return {
        ...current,
        keywords: [...current.keywords, value],
      };
    });
    setSeoKeywordInput("");
  };

  const handleRemoveSeoKeyword = (targetKeyword) => {
    setSeo((current) => ({
      ...current,
      keywords: current.keywords.filter((keyword) => keyword !== targetKeyword),
    }));
  };

  const handleToggleCategory = (categoryId) => {
    const numericId = Number(categoryId);
    if (!Number.isInteger(numericId) || numericId <= 0) return;

    setForm((current) => {
      const nextIds = current.categoryIds.includes(numericId)
        ? current.categoryIds.filter((id) => id !== numericId)
        : [...current.categoryIds, numericId];
      const normalizedIds = normalizeSelectedCategoryIds(nextIds);

      return {
        ...current,
        categoryIds: normalizedIds,
        defaultCategoryId: resolveDefaultCategoryId(
          normalizedIds,
          current.defaultCategoryId,
        ),
      };
    });
  };

  const handleRemoveImage = (imageUrl) => {
    setForm((current) => ({
      ...current,
      imageUrls: (current.imageUrls || []).filter(
        (entry) => entry !== imageUrl,
      ),
    }));
  };

  const handleSetPrimaryImage = (imageUrl) => {
    setForm((current) => {
      const nextImages = Array.isArray(current.imageUrls)
        ? current.imageUrls.filter(Boolean)
        : [];
      if (!nextImages.includes(imageUrl) || nextImages[0] === imageUrl) {
        return current;
      }

      return {
        ...current,
        imageUrls: [
          imageUrl,
          ...nextImages.filter((entry) => entry !== imageUrl),
        ],
      };
    });
  };

  const handleImageFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;
    setUploadStatus(null);
    const remainingSlots = Math.max(0, 6 - form.imageUrls.length);
    if (remainingSlots <= 0) {
      setUploadStatus({
        type: "error",
        message: "Seller draft media is limited to 6 images in this phase.",
      });
      return;
    }

    const allowedTypes = new Set(["image/jpeg", "image/png"]);
    const invalidTypeFile = files.find(
      (file) => !allowedTypes.has(String(file.type || "")),
    );
    if (invalidTypeFile) {
      setUploadStatus({
        type: "error",
        message: "Only JPG and PNG files are allowed for seller draft media.",
      });
      return;
    }

    const oversizedFile = files.find(
      (file) => Number(file.size || 0) > 2 * 1024 * 1024,
    );
    if (oversizedFile) {
      setUploadStatus({
        type: "error",
        message:
          "Each seller draft image must stay within the existing 2MB upload limit.",
      });
      return;
    }

    if (files.length > remainingSlots) {
      setUploadStatus({
        type: "warning",
        message: `Only ${remainingSlots} more image slot${
          remainingSlots === 1 ? "" : "s"
        } are available. Extra files were ignored.`,
      });
    }

    await uploadMutation.mutateAsync(files.slice(0, remainingSlots));
  };

  const addSelectedAttribute = () => {
    const nextId = Number(pendingAttributeId);
    if (!Number.isInteger(nextId) || nextId <= 0) return;
    const attribute = attributes.find((entry) => Number(entry?.id) === nextId);
    if (!attribute) return;

    setSelectedAttributes((current) => {
      if (current.some((entry) => Number(entry.id) === nextId)) return current;
      return [
        ...current,
        {
          id: nextId,
          name: String(
            attribute?.displayName || attribute?.display_name || attribute?.name || "",
          ).trim(),
        },
      ];
    });
    setPendingAttributeId("");
  };

  const removeSelectedAttribute = (attributeId) => {
    setSelectedAttributes((current) =>
      current.filter((entry) => Number(entry.id) !== Number(attributeId)),
    );
    setSelectedAttributeValues((current) =>
      current.filter((entry) => Number(entry.attributeId) !== Number(attributeId)),
    );
    setVariants((current) =>
      current.filter(
        (variant) =>
          !variant.selections.some(
            (selection) => Number(selection.attributeId) === Number(attributeId),
          ),
      ),
    );
    setAttributeValueSearch((current) => {
      const next = { ...current };
      delete next[attributeId];
      return next;
    });
  };

  const toggleAttributeValue = (attribute, value) => {
    setSelectedAttributeValues((current) => {
      const existing = current.find(
        (entry) => Number(entry.attributeId) === Number(attribute.id),
      );
      const nextValues = existing?.values || [];
      const dedupeKey = String(value.id ?? value.value).toLowerCase();
      const alreadySelected = nextValues.some(
        (entry) => String(entry.id ?? entry.value).toLowerCase() === dedupeKey,
      );
      const updatedValues = alreadySelected
        ? nextValues.filter(
            (entry) => String(entry.id ?? entry.value).toLowerCase() !== dedupeKey,
          )
        : [...nextValues, value];

      const nextEntry = {
        attributeId: Number(attribute.id),
        values: updatedValues,
      };

      if (!existing) return [...current, nextEntry];
      return current.map((entry) =>
        Number(entry.attributeId) === Number(attribute.id) ? nextEntry : entry,
      );
    });
  };

  const setAllAttributeValues = (attribute, values) => {
    setSelectedAttributeValues((current) => {
      const nextEntry = {
        attributeId: Number(attribute.id),
        values,
      };
      const hasExisting = current.some(
        (entry) => Number(entry.attributeId) === Number(attribute.id),
      );
      if (!hasExisting) return [...current, nextEntry];
      return current.map((entry) =>
        Number(entry.attributeId) === Number(attribute.id) ? nextEntry : entry,
      );
    });
  };

  const handleGenerateVariants = () => {
    if (selectedAttributes.length === 0) {
      setStatus({
        type: "error",
        message: "Select at least one attribute before generating variants.",
      });
      return;
    }

    if (!canGenerateVariants) {
      setStatus({
        type: "error",
        message: "Choose at least one value for every selected attribute.",
      });
      return;
    }

    const existingByKey = new Map(
      variants.map((entry) => [entry.combinationKey, entry]),
    );
    const nextVariants = previewCombinations.map((selections, index) => {
      const combination = buildVariantCombination(selections);
      const combinationKey = buildVariantCombinationKey(selections);
      const existing = existingByKey.get(combinationKey);
      if (existing) {
        return {
          ...existing,
          selections,
          combination,
          combinationKey,
        };
      }

      return {
        id: `variant-${Date.now()}-${index + 1}`,
        combination,
        combinationKey,
        selections,
        sku: "",
        barcode: "",
        price: normalizeVariantNumber(form.price),
        salePrice: resolveSalePriceValue(form.salePrice),
        quantity: normalizeVariantQuantity(form.stock),
        image: form.imageUrls?.[0] || null,
      };
    });

    setVariants(nextVariants);
    setStatus({
      type: "success",
      message: `${nextVariants.length} variant combination(s) prepared.`,
    });
  };

  const handleClearVariants = () => {
    if (variants.length === 0) return;
    if (!window.confirm("Clear all generated variants?")) return;
    setVariants([]);
  };

  const updateVariantField = (variantId, field, value) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              [field]: value,
            }
          : variant,
      ),
    );
  };

  const removeVariant = (variantId) => {
    setVariants((current) => current.filter((variant) => variant.id !== variantId));
  };

  const handleVariantImageUpload = async (variantId, file) => {
    if (!file) return;
    const allowedTypes = new Set(["image/jpeg", "image/png"]);
    if (!allowedTypes.has(String(file.type || ""))) {
      setStatus({
        type: "error",
        message: "Variant image must be JPG or PNG.",
      });
      return;
    }

    if (Number(file.size || 0) > 2 * 1024 * 1024) {
      setStatus({
        type: "error",
        message: "Each variant image must stay within the 2MB upload limit.",
      });
      return;
    }

    try {
      setVariantImageUploadingId(variantId);
      const url = await uploadSellerProductImage(file);
      updateVariantField(variantId, "image", url);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error?.response?.data?.message || "Failed to upload variant image.",
      });
    } finally {
      setVariantImageUploadingId(null);
    }
  };

  const buildPayload = () => {
    setStatus(null);
    setUploadStatus(null);

    const name = String(form.name || "").trim();
    const basePrice = Number(form.price || 0);
    const salePrice = form.salePrice === "" ? null : Number(form.salePrice);
    const stock = Number(form.stock || 0);

    if (!name) {
      setStatus({ type: "error", message: "Product name is required." });
      return null;
    }

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      setStatus({
        type: "error",
        message: "Base price must be a valid non-negative number.",
      });
      return null;
    }

    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0)) {
      setStatus({
        type: "error",
        message: "Sale price must be a valid non-negative number.",
      });
      return null;
    }

    if (salePrice !== null && salePrice > 0 && salePrice >= basePrice) {
      setStatus({
        type: "error",
        message: "Sale price must stay lower than the base price.",
      });
      return null;
    }

    if (!Number.isFinite(stock) || stock < 0) {
      setStatus({
        type: "error",
        message: "Stock must be a valid non-negative integer.",
      });
      return null;
    }

    if (!Number.isInteger(stock)) {
      setStatus({ type: "error", message: "Stock must be a whole number." });
      return null;
    }

    if (form.categoryIds.length > 0 && !form.defaultCategoryId) {
      setStatus({
        type: "error",
        message: "Choose a default category when categories are selected.",
      });
      return null;
    }

    if (hasVariants && variants.length === 0) {
      setStatus({
        type: "error",
        message: "Generate at least one variant combination before saving.",
      });
      setActiveTab("combination");
      return null;
    }

    if (
      hasVariants &&
      variants.some(
        (variant) =>
          variant.salePrice != null &&
          variant.price != null &&
          Number(variant.salePrice) >= Number(variant.price),
      )
    ) {
      setStatus({
        type: "error",
        message: "Variant sale price must stay lower than the variant price.",
      });
      setActiveTab("combination");
      return null;
    }

    if (
      hasVariants &&
      variants.some((variant) => variant.quantity != null && Number(variant.quantity) < 0)
    ) {
      setStatus({
        type: "error",
        message: "Variant quantity must be a valid non-negative integer.",
      });
      setActiveTab("combination");
      return null;
    }

    const seenCombinationKeys = new Set();
    if (hasVariants) {
      for (const variant of variants) {
        const combinationKey = String(variant.combinationKey || "").trim();
        const normalizedCombinationKey = combinationKey.toLowerCase();
        if (!combinationKey) {
          setStatus({
            type: "error",
            message: "One or more variants are missing a valid combination key.",
          });
          setActiveTab("combination");
          return null;
        }
        if (seenCombinationKeys.has(normalizedCombinationKey)) {
          setStatus({
            type: "error",
            message: "Duplicate variant combinations are not allowed.",
          });
          setActiveTab("combination");
          return null;
        }
        seenCombinationKeys.add(normalizedCombinationKey);
      }
    }

    const variationPayload = hasVariants
      ? {
          hasVariants: true,
          selectedAttributes,
          selectedAttributeValues,
        variants: variants.map((variant) => ({
          id: variant.id,
          combination: variant.combination,
          combinationKey: variant.combinationKey,
          selections: variant.selections,
          sku: String(variant.sku || "").trim() || null,
          barcode: String(variant.barcode || "").trim() || null,
          price: normalizeVariantNumber(variant.price),
          salePrice: resolveSalePriceValue(variant.salePrice),
          quantity: normalizeVariantQuantity(variant.quantity),
          stock: normalizeVariantQuantity(variant.quantity),
          image: variant.image || null,
        })),
      }
      : null;
    const seoPayload = {
      metaTitle: String(seo.metaTitle || "").trim(),
      metaDescription: String(seo.metaDescription || "").trim(),
      keywords: Array.isArray(seo.keywords)
        ? seo.keywords.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [],
      ogImageUrl: String(seo.ogImageUrl || "").trim(),
    };

    return {
      name,
      description: emptyToNull(form.description),
      sku: emptyToNull(form.sku),
      barcode: emptyToNull(form.barcode),
      slug: emptyToNull(form.slug) || slugify(name),
      categoryIds: form.categoryIds,
      defaultCategoryId: form.defaultCategoryId
        ? Number(form.defaultCategoryId)
        : null,
      price: basePrice,
      salePrice,
      stock,
      imageUrls: form.imageUrls,
      tags: Array.isArray(form.tags) ? form.tags : [],
      seo: seoPayload,
      hasVariants,
      variations: variationPayload,
    };
  };

  const handleSubmit = async (event, intent = "save") => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) return;

    let saved;

    try {
      saved = await mutation.mutateAsync(payload);
    } catch {
      return;
    }

    const nextVariationState = normalizeVariationEditorState(saved?.variations?.raw);
    setForm(createFormFromProduct(saved));
    setSeo(createSeoFromProduct(saved));
    setSeoKeywordInput("");
    setSlugTouched(Boolean(saved?.slug));
    setHasVariants(
      typeof saved?.hasVariants === "boolean"
        ? saved.hasVariants
        : nextVariationState.hasVariants,
    );
    setSelectedAttributes(nextVariationState.selectedAttributes);
    setSelectedAttributeValues(nextVariationState.selectedAttributeValues);
    setVariants(nextVariationState.variants);

    if (intent === "publish") {
      let published = null;

      try {
        published = await publishMutation.mutateAsync({
          productId: saved.id,
          published: true,
        });
      } catch {
        if (!isEditMode) {
          navigate(workspaceRoutes.productEdit(saved.id), { replace: true });
        }
        return;
      }

      setStatus({
        type: "success",
        message: published?.visibility?.storefrontVisible
          ? "Product published and is now synced to storefront visibility."
          : "Product published, but storefront visibility is still blocked.",
      });
      navigate(workspaceRoutes.productDetail(published.id), { replace: true });
      return;
    }

    setStatus({
      type: "success",
      message: isEditMode
        ? "Product changes saved in seller workspace."
        : "Draft created in seller workspace.",
    });

    if (typeof onSuccess === "function") {
      onSuccess(saved);
      return;
    }

    if (!isEditMode) {
      navigate(workspaceRoutes.productEdit(saved.id), { replace: true });
    }
  };

  const closeForm = () => {
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    navigate(workspaceRoutes.catalog(), { replace: true });
  };

  const backButton = (
    <Link
      key="back"
      to={workspaceRoutes.catalog()}
      className={sellerSecondaryButtonClass}
    >
      <ArrowLeft className="h-4 w-4" />
      Back to catalog
    </Link>
  );
  const fallbackAction = isDrawerMode ? (
    <button
      key="close"
      type="button"
      onClick={closeForm}
      className={sellerSecondaryButtonClass}
    >
      <X className="h-4 w-4" />
      Close
    </button>
  ) : (
    backButton
  );

  if (!canViewProducts) {
    return (
      <SellerWorkspaceStatePanel
        title="Catalog authoring is unavailable"
        description="Your current seller access does not include catalog visibility."
        tone="error"
        Icon={ShieldCheck}
      />
    );
  }

  if (isEditMode && !hasValidProductId) {
    return (
      <SellerWorkspaceStatePanel
        title="Seller product editing needs a valid product id"
        description="Open this lane from a product that belongs to the active seller store."
        action={fallbackAction}
        tone="warning"
        Icon={Package}
      />
    );
  }

  if (isBusy) {
    return (
      <SellerWorkspaceStatePanel
        title={
          isEditMode
            ? "Loading seller product editor"
            : "Loading seller product authoring"
        }
        description="Fetching seller authoring governance for the active store."
        action={fallbackAction}
        Icon={Package}
      />
    );
  }

  if (metaQuery.isError || (isEditMode && productQuery.isError)) {
    const error = productQuery.error || metaQuery.error;
    return (
      <SellerWorkspaceStatePanel
        title={
          isEditMode
            ? "Failed to load seller product"
            : "Failed to load seller product authoring"
        }
        description={getSellerRequestErrorMessage(error, {
          permissionMessage: isEditMode
            ? "Your current seller access does not include draft editing."
            : "Your current seller access does not include draft creation.",
          fallbackMessage: isEditMode
            ? "Failed to load seller draft."
            : "Failed to load seller draft authoring.",
        })}
        action={fallbackAction}
        tone="error"
        Icon={ShieldCheck}
      />
    );
  }

  if (!isEditMode && !canCreateDraft) {
    return (
      <SellerWorkspaceStatePanel
        title="Product creation is unavailable"
        description={
          authoringGovernance?.note ||
          "Your current seller access does not include product creation in this store."
        }
        action={fallbackAction}
        tone="warning"
        Icon={ShieldCheck}
      />
    );
  }

  if (isEditMode && productQuery.data && !canEditDraft) {
    return (
      <div className="space-y-4">
        <SellerWorkspaceStatePanel
          title="Product editing is unavailable"
          description={
            detailAuthoring?.editBlockedReason === "PRODUCT_STATUS_NOT_EDITABLE"
              ? "This product is outside the current seller edit states."
              : authoringGovernance?.note ||
                "Your current seller access does not include product editing for this store."
          }
          action={fallbackAction}
          tone="warning"
          Icon={ShieldCheck}
        />
        <div className="flex flex-wrap gap-2">
          <Link
            to={workspaceRoutes.productDetail(productQuery.data.id)}
            className={sellerSecondaryButtonClass}
          >
            <Eye className="h-4 w-4" />
            Open detail
          </Link>
        </div>
      </div>
    );
  }

  const saveActionLabel = mutation.isPending
    ? isEditMode
      ? "Updating..."
      : "Creating..."
    : isEditMode
      ? "Update Product"
      : "Add Product";
  const publishActionLabel = publishMutation.isPending
    ? "Publishing..."
    : isEditMode
      ? "Publish"
      : "Create & Publish";
  const editorTitle = isEditMode ? "Update Products" : "Add Product";
  const editorDescription = isEditMode
    ? "Update products info, combinations and extras."
    : "Add products info, combinations and extras.";

  return (
    <div
      className={
        isDrawerMode
          ? "flex h-full min-h-0 flex-col bg-white"
          : "-mx-4 -mt-4 min-h-[calc(100vh-4rem)] bg-slate-100/80 px-3 py-4 md:-mx-6 md:-mt-6 md:px-6 md:py-6"
      }
    >
      <div
        className={
          isDrawerMode
            ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
            : "ml-auto max-w-[1080px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]"
        }
      >
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold leading-tight text-slate-900">
                {editorTitle}
              </h1>
              <p className="text-sm text-slate-500">
                {editorDescription}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <select
                defaultValue="en"
                className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm text-slate-700 outline-none"
                aria-label="Language"
              >
                <option value="en">en</option>
              </select>
              <button
                type="button"
                onClick={closeForm}
                className={authoringIconButtonClass}
                aria-label="Close seller product editor"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          className={
            isDrawerMode
              ? "min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5 md:px-6"
              : "space-y-4 overflow-x-hidden px-4 py-4 sm:px-5 md:px-6"
          }
        >
          {status ? (
            <SellerWorkspaceNotice type={status.type}>
              {status.message}
            </SellerWorkspaceNotice>
          ) : null}

          {uploadStatus ? (
            <SellerWorkspaceNotice type={uploadStatus.type}>
              {uploadStatus.message}
            </SellerWorkspaceNotice>
          ) : null}

          {attributeOwnershipWarnings.length > 0 ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-1.5">
                  <p className="font-medium">
                    Some attributes may not belong to this store.
                  </p>
                  <div className="space-y-1 text-xs text-amber-800">
                    {attributeOwnershipWarnings.map((warning) => (
                      <div
                        key={`${warning.attributeId || "attribute"}-${warning.code || "warning"}`}
                      >
                        {warning.message ||
                          `Attribute mismatch: ${warning.attributeName || warning.attributeId}`}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isNeedsRevision ? (
            <SellerWorkspaceNotice type="warning">
              <div className="flex flex-wrap items-start gap-2">
                <DrawerChip
                  icon={Clock3}
                  label="Revision requested"
                  tone="amber"
                />
                {submissionReason ? (
                  <span className="text-sm text-slate-700">
                    {submissionReason}
                  </span>
                ) : (
                  <span className="text-sm text-slate-700">
                    Update the requested fields.
                  </span>
                )}
              </div>
            </SellerWorkspaceNotice>
          ) : null}

          <section className="space-y-5">
            <div className="border border-slate-200/70 bg-white px-4 py-5 md:px-5">
              <form className="space-y-6 overflow-x-hidden" onSubmit={handleSubmit}>
                <div className="-mx-4 border-b border-slate-200 px-4 pb-0 sm:-mx-5 sm:px-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                      {visibleTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`inline-flex h-11 shrink-0 items-center justify-center border-b-2 px-4 text-base font-semibold transition ${
                            activeTab === tab.id
                              ? "border-emerald-600 text-emerald-700"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled
                        title="SEO fields are limited in Seller authoring."
                        className="inline-flex h-11 shrink-0 cursor-not-allowed items-center justify-center border-b-2 border-transparent px-4 text-base font-semibold text-slate-400"
                      >
                        SEO
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 pb-3 lg:justify-end">
                      <span className="text-sm font-medium text-orange-500">
                        Does this product have variants?
                      </span>
                      <button
                        type="button"
                        onClick={() => setHasVariants((current) => !current)}
                        className={`relative inline-flex h-8 w-[68px] items-center rounded-full px-1 transition ${
                          hasVariants ? "bg-emerald-600" : "bg-slate-200"
                        }`}
                        aria-label="Toggle product variants"
                      >
                        <span
                          className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition ${
                            hasVariants ? "translate-x-[36px]" : "translate-x-0"
                          }`}
                        />
                        <span
                          className={`absolute right-2 text-sm font-semibold ${
                            hasVariants ? "text-white" : "text-slate-700"
                          }`}
                        >
                          {hasVariants ? "Yes" : "No"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {activeTab === "basic" ? (
                  <>
                <ProductField
                  label="Product Title/Name"
                  icon={FileText}
                  value={form.name}
                  onChange={handleNameChange}
                  disabled={mutation.isPending}
                  maxLength={255}
                  placeholder="Product Title/Name"
                />

                <ProductField
                  label="Product Description"
                  icon={FileText}
                  value={form.description}
                  onChange={handleChange("description")}
                  disabled={mutation.isPending}
                  multiline
                  placeholder="Product Description"
                />

                {canManageMedia ? (
                  <section className="border-t border-slate-200 pt-5">
                    <AuthoringFormRow label="Product Images">
                      <div className="space-y-3">
                        <div className="rounded-[20px] border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-8 w-8 text-emerald-500" />
                            <p className="text-xl font-medium text-slate-700">
                              Drag your images here
                            </p>
                            <p className="text-sm text-slate-400">
                              Only `.jpeg` and `.png` images are accepted
                            </p>
                            <label className="mt-2 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                              <Upload className="h-4 w-4" />
                              {uploadMutation.isPending ? "Uploading..." : "Choose Images"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png"
                                multiple
                                className="hidden"
                                disabled={uploadMutation.isPending || mutation.isPending}
                                onChange={async (event) => {
                                  try {
                                    await handleImageFiles(event.target.files);
                                  } finally {
                                    event.target.value = "";
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {Array.isArray(form.imageUrls) && form.imageUrls.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {form.imageUrls.map((imageUrl, index) => (
                              <div
                                key={`${imageUrl}-${index}`}
                                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                              >
                                <div className="relative h-24 overflow-hidden bg-slate-100">
                                  <img
                                    src={resolveAssetUrl(imageUrl)}
                                    alt={`Draft image ${index + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveImage(imageUrl)}
                                    className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm"
                                    aria-label="Remove draft image"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="flex items-center justify-between gap-2 px-3 py-2">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      index === 0
                                        ? "bg-blue-500 text-white"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {index === 0 ? "Default Image" : `Image ${index + 1}`}
                                  </span>
                                  {index !== 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleSetPrimaryImage(imageUrl)}
                                      className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-700"
                                    >
                                      Set primary
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </AuthoringFormRow>
                  </section>
                ) : (
                  <section className="space-y-4 border-t border-slate-200 pt-6">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <div className="inline-flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Media deferred</span>
                      </div>
                    </div>
                  </section>
                )}

                <AuthoringFormRow label="Product SKU / Barcode">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Product SKU
                      </label>
                      <input
                        className={`${authoringFieldClass} ${
                          mutation.isPending ? sellerDisabledFieldClass : ""
                        }`}
                        value={form.sku}
                        onChange={handleChange("sku")}
                        disabled={mutation.isPending}
                        maxLength={100}
                        placeholder="Product SKU"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Product Barcode
                      </label>
                      <input
                        className={`${authoringFieldClass} ${
                          mutation.isPending ? sellerDisabledFieldClass : ""
                        }`}
                        value={form.barcode}
                        onChange={handleChange("barcode")}
                        disabled={mutation.isPending}
                        maxLength={100}
                        placeholder="Product Barcode"
                      />
                    </div>
                  </div>
                </AuthoringFormRow>

                <section className="border-t border-slate-200 pt-5">
                  <div className="space-y-5">
                    <AuthoringFormRow label="Category">
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="search"
                            value={categorySearch}
                            onChange={(event) => setCategorySearch(event.target.value)}
                            placeholder="Select one or more categories"
                            className="h-11 w-full rounded-lg border border-emerald-200 bg-white pl-10 pr-10 text-sm text-slate-700 transition focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50"
                          />
                          {categorySearch ? (
                            <button
                              type="button"
                              onClick={() => setCategorySearch("")}
                              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              aria-label="Clear category search"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                        <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                          {categoryReference.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                              No published categories are available for seller assignment yet.
                            </div>
                          ) : filteredCategoryTree.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                              No categories match the current search.
                            </div>
                          ) : (
                            <SellerCategoryTree
                              tree={filteredCategoryTree}
                              selectedIds={form.categoryIds}
                              defaultCategoryId={form.defaultCategoryId}
                              onToggle={handleToggleCategory}
                            />
                          )}
                        </div>
                      </div>
                    </AuthoringFormRow>

                    <AuthoringFormRow label="Default Category">
                      <select
                        value={form.defaultCategoryId}
                        onChange={handleChange("defaultCategoryId")}
                        disabled={
                          mutation.isPending || selectedCategories.length === 0
                        }
                        className={`${authoringSelectClass} max-w-[260px] ${
                          mutation.isPending || selectedCategories.length === 0
                            ? sellerDisabledFieldClass
                            : ""
                        }`}
                      >
                        <option value="">Default Category</option>
                        {defaultCategoryOptions.map((category) => (
                          <option key={category.id} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </AuthoringFormRow>
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AuthoringFormRow label="Product Price">
                      <div className="flex h-11 w-full max-w-none items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <span className="inline-flex h-11 w-12 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          Rp
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.price}
                          onChange={handleChange("price")}
                          disabled={mutation.isPending}
                          placeholder="0"
                          className={`h-11 w-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none ${
                            mutation.isPending ? sellerDisabledFieldClass : ""
                          }`}
                        />
                      </div>
                    </AuthoringFormRow>

                    <AuthoringFormRow label="Sale Price">
                      <div className="flex h-11 w-full max-w-none items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <span className="inline-flex h-11 w-12 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          Rp
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.salePrice}
                          onChange={handleChange("salePrice")}
                          disabled={mutation.isPending}
                          placeholder=""
                          className={`h-11 w-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none ${
                            mutation.isPending ? sellerDisabledFieldClass : ""
                          }`}
                        />
                      </div>
                    </AuthoringFormRow>
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AuthoringFormRow label="Product Quantity">
                      <input
                        className={`${authoringFieldClass} ${
                          mutation.isPending ? sellerDisabledFieldClass : ""
                        }`}
                        value={form.stock}
                        onChange={handleChange("stock")}
                        disabled={mutation.isPending}
                        type="number"
                        min="0"
                        step="1"
                        placeholder=""
                      />
                    </AuthoringFormRow>
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AuthoringFormRow label="Product Slug">
                      <input
                        className={`${authoringFieldClass} ${
                          mutation.isPending ? sellerDisabledFieldClass : ""
                        }`}
                        value={form.slug}
                        onChange={handleSlugChange}
                        disabled={mutation.isPending}
                        placeholder="Product Slug"
                      />
                    </AuthoringFormRow>
                  </div>
                </section>

                <section className="space-y-4 border-t border-slate-200 pt-6">
                  <AuthoringFormRow label="Product Tags">
                  <div className="space-y-2.5 rounded-[18px] border border-slate-200/70 bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Tag className="h-3.5 w-3.5" />
                      Tags
                    </p>
                    <span className="text-xs font-medium text-slate-500">
                      {form.tags.length} tags
                    </span>
                  </div>
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Product Tag (Write then press enter to add new tag)"
                    className={authoringFieldClass}
                    disabled={mutation.isPending}
                  />
                  {form.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {form.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                          title={`Remove ${tag}`}
                        >
                          <Tag className="h-3.5 w-3.5" />
                          {tag}
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  </div>
                  </AuthoringFormRow>
                </section>
                  </>
                ) : null}

                {activeTab === "combination" && hasVariants ? (
                  <div className="space-y-5 border-t border-slate-200 pt-6">
                    <FormSectionLabel
                      eyebrow="Combination"
                      title="Variant Combinations"
                      description="Select attributes, choose values, review combinations, then generate editable variant rows."
                    />

                    <div className="grid gap-5 xl:grid-cols-3">
                      <div className="space-y-4 rounded-[18px] border border-slate-200/70 bg-slate-50/70 p-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Step 1
                          </p>
                          <h3 className="text-base font-semibold text-slate-900">
                            Select Attributes
                          </h3>
                        </div>
                        <input
                          type="text"
                          value={attributeSearch}
                          onChange={(event) => setAttributeSearch(event.target.value)}
                          placeholder="Search attributes"
                          className={authoringFieldClass}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <select
                            value={pendingAttributeId}
                            onChange={(event) => setPendingAttributeId(event.target.value)}
                            className={authoringSelectClass}
                          >
                            <option value="">Select attribute</option>
                            {availableAttributes.map((attribute) => (
                              <option key={attribute.id} value={String(attribute.id)}>
                                {attribute.displayName || attribute.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={addSelectedAttribute}
                            disabled={!pendingAttributeId}
                            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Add attribute
                          </button>
                        </div>
                        {selectedAttributes.length > 0 ? (
                          <div className="space-y-3">
                            {selectedAttributesWithValues.map(({ attribute, values }) => (
                              <div
                                key={attribute.id}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {attribute.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {values.length > 0
                                        ? `${values.length} value${values.length === 1 ? "" : "s"} selected`
                                        : "No values selected"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeSelectedAttribute(attribute.id)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
                                    aria-label={`Remove ${attribute.name}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {values.length > 0 ? (
                                    values.map((value) => (
                                      <span
                                        key={`${attribute.id}-${String(value.id ?? value.value).toLowerCase()}`}
                                        className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                      >
                                        {value.label || value.value}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-400">
                                      Pick values in the next step.
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">
                            Select attributes to start generating variants
                          </p>
                        )}
                      </div>

                      <div className="space-y-4 rounded-[18px] border border-slate-200/70 bg-white p-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Step 2
                          </p>
                          <h3 className="text-base font-semibold text-slate-900">
                            Select Values
                          </h3>
                        </div>
                        {selectedAttributes.length === 0 ? (
                          <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                            Select attributes to start generating variants
                          </div>
                        ) : null}
                        {selectedAttributes.map((attribute) => {
                          const allValues = Array.isArray(attributeValuesMap[attribute.id])
                            ? attributeValuesMap[attribute.id]
                            : [];
                          const currentSearch = String(
                            attributeValueSearch[attribute.id] || "",
                          )
                            .trim()
                            .toLowerCase();
                          const filteredValues = allValues.filter((value) =>
                            String(value?.label || value?.value || "")
                              .toLowerCase()
                              .includes(currentSearch),
                          );
                          const selectedEntry =
                            selectedAttributeValues.find(
                              (entry) =>
                                Number(entry.attributeId) === Number(attribute.id),
                            ) || null;
                          const selectedValueKeys = new Set(
                            (selectedEntry?.values || []).map((value) =>
                              String(value.id ?? value.value).toLowerCase(),
                            ),
                          );

                          return (
                            <div
                              key={attribute.id}
                              className="rounded-[18px] border border-slate-200 bg-slate-50/60 p-4"
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    Select {attribute.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Choose values to include in generated variants.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setAllAttributeValues(attribute, filteredValues)}
                                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                                >
                                  Select All
                                </button>
                              </div>
                              <input
                                type="text"
                                value={attributeValueSearch[attribute.id] || ""}
                                onChange={(event) =>
                                  setAttributeValueSearch((current) => ({
                                    ...current,
                                    [attribute.id]: event.target.value,
                                  }))
                                }
                                placeholder={`Search ${attribute.name} values`}
                                className={authoringFieldClass}
                              />
                              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                                {filteredValues.map((value) => {
                                  const dedupeKey = String(
                                    value.id ?? value.value,
                                  ).toLowerCase();
                                  const checked = selectedValueKeys.has(dedupeKey);
                                  return (
                                    <label
                                      key={`${attribute.id}-${dedupeKey}`}
                                      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleAttributeValue(attribute, value)}
                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span>{value.label || value.value}</span>
                                    </label>
                                  );
                                })}
                                {attributeValuesLoading && filteredValues.length === 0 ? (
                                  <p className="text-sm text-slate-500">
                                    Loading values...
                                  </p>
                                ) : null}
                                {!attributeValuesLoading && filteredValues.length === 0 ? (
                                  <p className="text-sm text-slate-500">
                                    No values available.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-4 rounded-[18px] border border-slate-200/70 bg-slate-50/70 p-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Step 3
                          </p>
                          <h3 className="text-base font-semibold text-slate-900">
                            Preview + Generate
                          </h3>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              Combination Preview
                            </p>
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                              {previewCombinations.length} preview
                            </span>
                          </div>
                          {previewCombinations.length > 0 ? (
                            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                              {previewCombinations.map((selections, index) => {
                                const previewKey = buildVariantCombinationKey(selections);
                                const isGenerated = generatedCombinationKeys.has(
                                  previewKey.toLowerCase(),
                                );
                                return (
                                  <div
                                    key={`${previewKey}-${index + 1}`}
                                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                                  >
                                    <span className="text-sm text-slate-700">
                                      {buildVariantCombination(selections)}
                                    </span>
                                    {isGenerated ? (
                                      <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                        Generated
                                      </span>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                              Select attributes to start generating variants
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-3">
                          <button
                            type="button"
                            onClick={handleGenerateVariants}
                            disabled={!canGenerateVariants}
                            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Generate Variants
                          </button>
                          <button
                            type="button"
                            onClick={handleClearVariants}
                            disabled={variants.length === 0}
                            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Clear Variants
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[18px] border border-slate-200">
                      <div className="max-h-[560px] overflow-auto">
                        <table className="min-w-[920px] divide-y divide-slate-200">
                          <thead className="sticky top-0 z-10 bg-slate-50">
                            <tr>
                              {[
                                "Image",
                                "Combination",
                                "SKU",
                                "Barcode",
                                "Price",
                                "Sale Price",
                                "Quantity",
                                "Action",
                              ].map((label) => (
                                <th
                                  key={label}
                                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500"
                                >
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {variants.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="px-4 py-8 text-center text-sm text-slate-500"
                                >
                                  No variants available
                                </td>
                              </tr>
                            ) : (
                              variants.map((variant, index) => (
                                <tr
                                  key={variant.id}
                                  className={
                                    index % 2 === 0
                                      ? "bg-white transition hover:bg-emerald-50/40"
                                      : "bg-slate-50/55 transition hover:bg-emerald-50/40"
                                  }
                                >
                                  <td className="px-4 py-3 align-top">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                        {variant.image ? (
                                          <img
                                            src={resolveAssetUrl(variant.image)}
                                            alt={variant.combination}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-[11px] font-semibold text-slate-400">
                                            IMG
                                          </span>
                                        )}
                                      </div>
                                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                        {variantImageUploadingId === variant.id
                                          ? "Uploading..."
                                          : "Change"}
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png"
                                          className="hidden"
                                          onChange={(event) =>
                                            handleVariantImageUpload(
                                              variant.id,
                                              event.target.files?.[0] || null,
                                            )
                                          }
                                        />
                                      </label>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                    <div className="space-y-1">
                                      <div>{variant.combination}</div>
                                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                                        {variant.combinationKey}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={variant.sku}
                                      onChange={(event) =>
                                        updateVariantField(
                                          variant.id,
                                          "sku",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Sku"
                                      className={authoringFieldClass}
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={variant.barcode}
                                      onChange={(event) =>
                                        updateVariantField(
                                          variant.id,
                                          "barcode",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Barcode"
                                      className={authoringFieldClass}
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                                      <span className="inline-flex h-11 w-12 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                                        Rp
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={variant.price ?? ""}
                                        onChange={(event) =>
                                          updateVariantField(
                                            variant.id,
                                            "price",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 w-full bg-transparent px-3 text-sm focus:outline-none"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                                      <span className="inline-flex h-11 w-12 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                                        Rp
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={variant.salePrice ?? ""}
                                        onChange={(event) =>
                                          updateVariantField(
                                            variant.id,
                                            "salePrice",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 w-full bg-transparent px-3 text-sm focus:outline-none"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={variant.quantity ?? ""}
                                      onChange={(event) =>
                                        updateVariantField(
                                          variant.id,
                                          "quantity",
                                          event.target.value,
                                        )
                                      }
                                      className={authoringFieldClass}
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => removeVariant(variant.id)}
                                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                                      aria-label={`Remove ${variant.combination}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "seo" ? (
                  <div className="space-y-5 border-t border-slate-200 pt-6">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        SEO
                      </p>
                      <h2 className="text-base font-semibold text-slate-900">
                        Search Preview
                      </h2>
                      <p className="text-xs text-slate-500">
                        Control how this product appears in search and social previews.
                      </p>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                      <div className="space-y-5">
                        <AuthoringFormRow label="Meta Title">
                          <div className="space-y-2">
                            <input
                              value={seo.metaTitle}
                              onChange={(event) =>
                                setSeo((current) => ({
                                  ...current,
                                  metaTitle: event.target.value,
                                }))
                              }
                              placeholder="Custom SEO title (leave empty to use product title)"
                              className={authoringFieldClass}
                              disabled={mutation.isPending}
                              maxLength={255}
                            />
                            <div className="flex items-center justify-between text-xs">
                              <span className={seoMetaTitleSoftWarning ? "text-amber-600" : "text-slate-400"}>
                                {seoMetaTitleSoftWarning || "Recommended maximum is 70 characters."}
                              </span>
                              <span className="text-slate-400">
                                {String(seo.metaTitle || "").trim().length} / 255
                              </span>
                            </div>
                          </div>
                        </AuthoringFormRow>

                        <AuthoringFormRow label="Meta Description">
                          <div className="space-y-2">
                            <textarea
                              value={seo.metaDescription}
                              onChange={(event) =>
                                setSeo((current) => ({
                                  ...current,
                                  metaDescription: event.target.value,
                                }))
                              }
                              placeholder="Custom SEO description (leave empty to use product description)"
                              className={`${authoringFieldClass} min-h-[132px] py-3`}
                              disabled={mutation.isPending}
                              maxLength={1000}
                            />
                            <div className="flex items-center justify-between text-xs">
                              <span
                                className={
                                  seoMetaDescriptionSoftWarning
                                    ? "text-amber-600"
                                    : "text-slate-400"
                                }
                              >
                                {seoMetaDescriptionSoftWarning ||
                                  "Recommended maximum is 160 characters."}
                              </span>
                              <span className="text-slate-400">
                                {String(seo.metaDescription || "").trim().length} / 1000
                              </span>
                            </div>
                          </div>
                        </AuthoringFormRow>

                        <AuthoringFormRow label="SEO Keywords">
                          <div className="space-y-2.5 rounded-[18px] border border-slate-200/70 bg-white px-3 py-3">
                            <input
                              value={seoKeywordInput}
                              onChange={(event) => setSeoKeywordInput(event.target.value)}
                              onKeyDown={handleSeoKeywordKeyDown}
                              placeholder="Type and press Enter to add SEO keywords"
                              className={authoringFieldClass}
                              disabled={mutation.isPending}
                            />
                            {seo.keywords.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {seo.keywords.map((keyword) => (
                                  <button
                                    key={keyword}
                                    type="button"
                                    onClick={() => handleRemoveSeoKeyword(keyword)}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                                  >
                                    {keyword}
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400">
                                No SEO keywords added yet.
                              </p>
                            )}
                          </div>
                        </AuthoringFormRow>

                        <AuthoringFormRow label="OG Image URL">
                          <div className="space-y-2">
                            <input
                              value={seo.ogImageUrl}
                              onChange={(event) =>
                                setSeo((current) => ({
                                  ...current,
                                  ogImageUrl: event.target.value,
                                }))
                              }
                              placeholder="Open Graph image URL (leave empty to use product image)"
                              className={authoringFieldClass}
                              disabled={mutation.isPending}
                            />
                            {seoOgImageWarning ? (
                              <p className="text-xs text-amber-600">{seoOgImageWarning}</p>
                            ) : null}
                          </div>
                        </AuthoringFormRow>
                      </div>

                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-sm font-semibold text-slate-900">SEO Preview</p>
                        <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
                          <p className="text-[22px] leading-snug text-[#2563eb]">
                            {seoPreview.title}
                          </p>
                          <p className="mt-1 text-sm text-emerald-700">{seoPreview.url}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {seoPreview.description}
                          </p>
                          <div className="mt-4 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Preview Source
                            </p>
                            <div className="space-y-1 text-xs text-slate-500">
                              <p>
                                Title:{" "}
                                <span className="font-medium text-slate-700">
                                  {String(seo.metaTitle || "").trim()
                                    ? "Custom meta title"
                                    : "Product name fallback"}
                                </span>
                              </p>
                              <p>
                                Description:{" "}
                                <span className="font-medium text-slate-700">
                                  {String(seo.metaDescription || "").trim()
                                    ? "Custom meta description"
                                    : "Product description fallback"}
                                </span>
                              </p>
                              <p>
                                Image:{" "}
                                <span className="font-medium text-slate-700 break-all">
                                  {seoPreview.image || "Product image fallback"}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {showPublishBlockers ? (
                  <div className="rounded-[20px] border border-amber-200 bg-amber-50/90 px-3.5 py-3 text-sm text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium">
                          Publish needs a few updates.
                        </p>
                        <ul className="space-y-1 text-xs text-amber-800">
                          {publishBlockers.map((entry) => (
                            <li
                              key={`${entry.field || "field"}-${entry.code || entry.message}`}
                            >
                              {entry.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="sticky bottom-0 -mx-1 space-y-3 border-t border-slate-200 bg-white/98 px-1 py-3 backdrop-blur">
                  {(isEditMode && canManagePublish) || (isEditMode && publishing?.canUnpublish) || canSubmitForReview ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {isEditMode && canManagePublish ? (
                        <button
                          type="button"
                          disabled={
                            mutation.isPending ||
                            publishMutation.isPending ||
                            (isEditMode && !publishing?.canPublish)
                          }
                          onClick={(event) => handleSubmit(event, "publish")}
                          className={authoringActionPrimaryClass}
                          title={isEditMode ? publishing?.hint || "Publish" : "Publish"}
                        >
                          <Globe2 className="h-4 w-4" />
                          {publishActionLabel}
                        </button>
                      ) : null}
                      {isEditMode && publishing?.canUnpublish ? (
                        <button
                          type="button"
                          disabled={publishMutation.isPending}
                          onClick={async () => {
                            setStatus(null);
                            let updated = null;

                            try {
                              updated = await publishMutation.mutateAsync({
                                productId,
                                published: false,
                              });
                            } catch {
                              return;
                            }

                            setStatus({
                              type: "success",
                              message: "Product hidden from storefront.",
                            });
                            const nextVariationState = normalizeVariationEditorState(
                              updated?.variations?.raw,
                            );
                            setForm(createFormFromProduct(updated));
                            setSeo(createSeoFromProduct(updated));
                            setSeoKeywordInput("");
                            setHasVariants(
                              typeof updated?.hasVariants === "boolean"
                                ? updated.hasVariants
                                : nextVariationState.hasVariants,
                            );
                            setSelectedAttributes(nextVariationState.selectedAttributes);
                            setSelectedAttributeValues(
                              nextVariationState.selectedAttributeValues,
                            );
                            setVariants(nextVariationState.variants);
                          }}
                          className={authoringActionMutedClass}
                        >
                          <EyeOff className="h-4 w-4" />
                          {publishMutation.isPending ? "Updating..." : "Unpublish"}
                        </button>
                      ) : null}
                      {canSubmitForReview ? (
                        <button
                          type="button"
                          disabled={mutation.isPending || submitMutation.isPending}
                          onClick={async () => {
                            setStatus(null);
                            await submitMutation.mutateAsync();
                          }}
                          className={authoringActionMutedClass}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {submitMutation.isPending
                            ? "Submitting..."
                            : submission?.status === "needs_revision"
                              ? "Resubmit"
                              : "Submit Review"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                      to={workspaceRoutes.catalog()}
                      onClick={(event) => {
                        if (isDrawerMode) {
                          event.preventDefault();
                          closeForm();
                        }
                      }}
                      className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-5 text-base font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={mutation.isPending}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isEditMode ? (
                        <Save className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {saveActionLabel}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

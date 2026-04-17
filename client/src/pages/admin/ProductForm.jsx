import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminProduct,
  fetchAdminAttributes,
  fetchAdminAttributeValues,
  fetchAdminCategories,
  fetchAdminProduct,
  updateAdminProduct,
  uploadAdminImage,
} from "../../lib/adminApi.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { ChevronDown, ChevronRight, UploadCloud, X } from "lucide-react";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PRODUCT_IMAGES = 5;
const readImageDimensions = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to read image dimensions."));
    };
    image.src = objectUrl;
  });

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const toParentId = (category) => {
  const raw = category?.parentId ?? category?.parent_id ?? category?.parent?.id ?? null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const buildCategoryTree = (categories) => {
  const safe = Array.isArray(categories) ? categories : [];
  const ids = new Set(
    safe
      .map((category) => Number(category?.id))
      .filter((id) => Number.isFinite(id) && id > 0)
  );

  const byParent = new Map();
  safe.forEach((category) => {
    const parentId = toParentId(category);
    const key = parentId && ids.has(parentId) ? parentId : 0;
    const bucket = byParent.get(key) || [];
    bucket.push(category);
    byParent.set(key, bucket);
  });

  const attachChildren = (node) => ({
    ...node,
    children: (byParent.get(Number(node?.id) || -1) || []).map(attachChildren),
  });

  return (byParent.get(0) || []).map(attachChildren);
};

const collectExpandableIds = (nodes, bucket = new Set()) => {
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    if (Array.isArray(node?.children) && node.children.length > 0) {
      bucket.add(Number(node.id));
      collectExpandableIds(node.children, bucket);
    }
  });
  return bucket;
};

const normalizeSelectedCategoryIds = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => Number(entry))
        .filter((entry) => Number.isInteger(entry) && entry > 0)
    )
  );

const resolveDefaultCategoryId = (categoryIds, currentDefaultCategoryId) => {
  const normalizedIds = normalizeSelectedCategoryIds(categoryIds);
  const normalizedDefault = Number(currentDefaultCategoryId);

  if (normalizedIds.length === 0) return null;
  if (Number.isInteger(normalizedDefault) && normalizedIds.includes(normalizedDefault)) {
    return normalizedDefault;
  }
  return normalizedIds[0];
};

const fieldInputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50";
const fieldTextareaClass =
  "h-32 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50";
const sectionCardClass =
  "rounded-[24px] border border-slate-200/90 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)] sm:p-5";
const sectionTitleClass = "text-base font-semibold text-slate-900";
const resolveSalePriceValue = (value) =>
  String(value ?? "").trim() === "" ? null : Number(value);
const PRODUCT_EDIT_TABS = [
  { id: "basic", label: "Basic Info" },
  { id: "combination", label: "Combination" },
  { id: "seo", label: "SEO" },
];
const defaultSeoState = {
  metaTitle: "",
  metaDescription: "",
  keywords: [],
  ogImageUrl: "",
};
const defaultVariationState = {
  hasVariants: false,
  selectedAttributes: [],
  selectedAttributeValues: [],
  variants: [],
};
const normalizeVariantNumber = (value) => {
  if (value === null || typeof value === "undefined" || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const normalizeVariantQuantity = (value) => {
  if (value === null || typeof value === "undefined" || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
};
const buildVariantCombination = (selections) =>
  selections.map((entry) => entry.value).filter(Boolean).join(" / ");
const buildVariantCombinationKey = (selections) =>
  selections
    .map((entry) => `${entry.attributeId}:${String(entry.valueId ?? entry.value).trim().toLowerCase()}`)
    .join("|");
const buildCartesianProduct = (attributesWithValues) => {
  if (!Array.isArray(attributesWithValues) || attributesWithValues.length === 0) return [];
  return attributesWithValues.reduce(
    (acc, attributeGroup) => {
      const next = [];
      acc.forEach((prefix) => {
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
    [[]]
  );
};
const normalizeVariationState = (value) => {
  if (!value) return defaultVariationState;
  if (typeof value === "string") {
    try {
      return normalizeVariationState(JSON.parse(value));
    } catch {
      return defaultVariationState;
    }
  }

  const raw =
    Array.isArray(value) ? { hasVariants: value.length > 0, variants: value } : value;
  const selectedAttributesMap = new Map();
  (Array.isArray(raw?.selectedAttributes) ? raw.selectedAttributes : []).forEach((entry) => {
    const id = Number(entry?.id);
    const name = String(entry?.name || "").trim();
    if (Number.isInteger(id) && id > 0 && name) {
      selectedAttributesMap.set(id, { id, name });
    }
  });

  const selectedAttributeValuesMap = new Map();
  (Array.isArray(raw?.selectedAttributeValues) ? raw.selectedAttributeValues : []).forEach((entry) => {
    const attributeId = Number(entry?.attributeId);
    if (!Number.isInteger(attributeId) || attributeId <= 0) return;
    const values = Array.isArray(entry?.values)
      ? entry.values
          .map((item) => {
            const idValue = item?.id ?? null;
            const valueText = String(item?.value ?? item?.label ?? "").trim();
            if (!valueText) return null;
            return {
              id: idValue,
              label: String(item?.label ?? valueText).trim(),
              value: valueText,
            };
          })
          .filter(Boolean)
      : [];
    selectedAttributeValuesMap.set(attributeId, { attributeId, values });
  });

  const variants = (Array.isArray(raw?.variants) ? raw.variants : [])
    .map((entry, index) => {
      const selections = Array.isArray(entry?.selections)
        ? entry.selections
            .map((selection) => {
              const attributeId = Number(selection?.attributeId);
              const attributeName = String(selection?.attributeName || "").trim();
              const value = String(selection?.value || "").trim();
              if (!Number.isInteger(attributeId) || attributeId <= 0 || !attributeName || !value) {
                return null;
              }
              const valueId = selection?.valueId ?? null;
              selectedAttributesMap.set(attributeId, { id: attributeId, name: attributeName });
              const existing = selectedAttributeValuesMap.get(attributeId) || {
                attributeId,
                values: [],
              };
              const dedupeKey = String(valueId ?? value).toLowerCase();
              if (!existing.values.some((item) => String(item.id ?? item.value).toLowerCase() === dedupeKey)) {
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

      const combination = String(entry?.combination || buildVariantCombination(selections)).trim();
      const combinationKey = String(entry?.combinationKey || buildVariantCombinationKey(selections)).trim();
      if (!combination || !combinationKey) return null;
      return {
        id: String(entry?.id || `variant-${index + 1}`),
        combination,
        combinationKey,
        selections,
        sku: String(entry?.sku || ""),
        barcode: String(entry?.barcode || ""),
        price: normalizeVariantNumber(entry?.price),
        salePrice: normalizeVariantNumber(entry?.salePrice),
        quantity: normalizeVariantQuantity(entry?.quantity),
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
const normalizeSeoState = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSeoState;
  }

  const keywords = Array.isArray(value?.keywords)
    ? value.keywords
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .filter((entry, index, list) => list.findIndex((item) => item.toLowerCase() === entry.toLowerCase()) === index)
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

function FormRow({ label, helper, children }) {
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

function SectionHeader({ eyebrow, title, description, meta = null }) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className={`${sectionTitleClass} mt-1`}>{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {meta ? <div className="shrink-0">{meta}</div> : null}
    </div>
  );
}

function CategoryTree({ tree, selectedIds, onToggle }) {
  const [expanded, setExpanded] = useState(() => collectExpandableIds(tree));

  useEffect(() => {
    setExpanded(collectExpandableIds(tree));
  }, [tree]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node) => {
    const nodeId = Number(node?.id);
    const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
    const isOpen = expanded.has(nodeId);
    const isSelected = selectedIds.includes(nodeId);

    return (
      <div key={nodeId} className="space-y-1">
        <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-slate-50">
          <button
            type="button"
            onClick={() => (hasChildren ? toggleExpand(nodeId) : null)}
            className="inline-flex h-4 w-4 items-center justify-center text-slate-500"
            aria-label={hasChildren ? "Toggle category children" : "Category leaf"}
          >
            {hasChildren ? (
              isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            )}
          </button>
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(nodeId)}
              className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-400"
            />
            {node?.name}
          </label>
        </div>
        {hasChildren && isOpen ? (
          <div className="ml-5 space-y-1 border-l border-slate-100 pl-3">
            {node.children.map((child) => renderNode(child))}
          </div>
        ) : null}
      </div>
    );
  };

  if (!tree.length) {
    return <p className="text-sm text-slate-500">No categories available.</p>;
  }

  return <div className="space-y-1">{tree.map((node) => renderNode(node))}</div>;
}

export default function ProductForm({ mode = "page", onClose, onSuccess, productId = null }) {
  const { id: routeId } = useParams();
  const activeProductId = productId ?? routeId ?? null;
  const isEdit = Boolean(activeProductId);
  const isDrawerMode = mode === "drawer";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const localImagesRef = useRef([]);
  const [notice, setNotice] = useState(null);
  const [dragActive, setDragActive] = useState(false);
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
  const [tagInput, setTagInput] = useState("");
  const [seoKeywordInput, setSeoKeywordInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [localImages, setLocalImages] = useState([]);
  const [seo, setSeo] = useState(defaultSeoState);
  const [form, setForm] = useState({
    name: "",
    description: "",
    sku: "",
    barcode: "",
    categoryIds: [],
    defaultCategoryId: null,
    price: "",
    salePrice: "",
    stock: "",
    slug: "",
    tags: [],
    status: "active",
    imageUrl: "",
  });
  const activeSectionClass = isDrawerMode
    ? "border-t border-slate-200 px-0 py-5 first:border-t-0"
    : sectionCardClass;
  const showCompactSectionHeaders = !isDrawerMode;

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories-add-product"],
    queryFn: () => fetchAdminCategories({ page: 1, limit: 200 }),
  });
  const attributesQuery = useQuery({
    queryKey: ["admin-product-attributes"],
    queryFn: async () => {
      const response = await fetchAdminAttributes();
      return Array.isArray(response?.data) ? response.data : [];
    },
  });
  const productQuery = useQuery({
    queryKey: ["admin-product", activeProductId],
    queryFn: () => fetchAdminProduct(activeProductId),
    enabled: isEdit,
  });

  const categories = categoriesQuery.data?.data || [];
  const attributes = Array.isArray(attributesQuery.data) ? attributesQuery.data : [];
  const visibleTabs = useMemo(
    () => PRODUCT_EDIT_TABS.filter((tab) => tab.id !== "combination" || hasVariants),
    [hasVariants]
  );
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const selectedCategories = useMemo(() => {
    const selectedIdSet = new Set(normalizeSelectedCategoryIds(form.categoryIds));
    return categories.filter((category) => selectedIdSet.has(Number(category.id)));
  }, [categories, form.categoryIds]);
  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategories.length === 0) return "No category selected";
    if (selectedCategories.length === 1) return selectedCategories[0].name;
    return `${selectedCategories.length} categories selected`;
  }, [selectedCategories]);
  const seoPreview = useMemo(() => {
    const fallbackSlug = form.slug || slugify(form.name);
    const fallbackImage =
      seo.ogImageUrl ||
      form.imageUrl ||
      (Array.isArray(localImages) && localImages[0]?.url ? localImages[0].url : "") ||
      "";

    return {
      title: seo.metaTitle || form.name || "Product title preview",
      description:
        seo.metaDescription ||
        form.description ||
        "Product description will appear here once you add product details.",
      url: fallbackSlug ? `/product/${encodeURIComponent(fallbackSlug)}` : "/product/your-product-slug",
      imageSource: fallbackImage,
    };
  }, [form.description, form.imageUrl, form.name, form.slug, localImages, seo]);
  const seoOgImageWarning = useMemo(() => {
    if (!seo.ogImageUrl) return "";
    return isLikelySeoImageUrl(seo.ogImageUrl)
      ? ""
      : "Use an absolute http(s) URL or a local path that starts with /.";
  }, [seo.ogImageUrl]);
  const availableAttributes = useMemo(() => {
    const selectedIds = new Set(selectedAttributes.map((entry) => Number(entry.id)));
    const keyword = String(attributeSearch || "").trim().toLowerCase();
    return attributes.filter((attribute) => {
      const id = Number(attribute?.id);
      if (!Number.isInteger(id) || selectedIds.has(id)) return false;
      const name = String(attribute?.displayName || attribute?.display_name || attribute?.name || "").trim();
      if (!keyword) return true;
      return name.toLowerCase().includes(keyword);
    });
  }, [attributeSearch, attributes, selectedAttributes]);
  const defaultCategoryOptions = selectedCategories;
  const closeForm = () => {
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    navigate("/admin/catalog/products", { replace: true });
  };
  const handleSubmitSuccess = () => {
    if (typeof onSuccess === "function") onSuccess();
    closeForm();
  };

  useEffect(() => {
    if (!hasVariants && activeTab === "combination") {
      setActiveTab("basic");
    }
  }, [activeTab, hasVariants]);

  useEffect(() => {
    if (!isEdit) return;
    const product = productQuery.data?.data;
    if (!product) return;

    const initialName = String(product.name || "");
    const initialSlug = String(product.slug || "");
    const initialCategoryIds = normalizeSelectedCategoryIds(
      product.categoryIds?.length
        ? product.categoryIds
        : product.defaultCategoryId
          ? [product.defaultCategoryId]
          : product.categoryId
            ? [product.categoryId]
            : []
    );
    const initialDefaultCategoryId = resolveDefaultCategoryId(
      initialCategoryIds,
      product.defaultCategoryId ?? product.categoryId ?? null
    );
    const initialImagePaths = Array.isArray(product.imagePaths)
      ? product.imagePaths.filter(Boolean)
      : [];
    const initialImages =
      initialImagePaths.length > 0
        ? initialImagePaths
        : product.promoImagePath
          ? [product.promoImagePath]
          : product.imageUrl
            ? [product.imageUrl]
            : [];
    const initialImage = initialImages[0] || "";
    const initialTags = Array.isArray(product.tags)
      ? product.tags.map((tag) => String(tag))
      : [];
    const initialSeo = normalizeSeoState(product.seo);
    const variationState = normalizeVariationState(product.variations);

    setForm({
      name: initialName,
      description: product.description || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      categoryIds: initialCategoryIds,
      defaultCategoryId: initialDefaultCategoryId,
      price: String(product.price ?? ""),
      salePrice: String(product.salePrice ?? ""),
      stock: String(product.stock ?? ""),
      slug: initialSlug,
      tags: initialTags,
      status: product.status || "active",
      imageUrl: initialImage,
    });
    setHasVariants(variationState.hasVariants);
    setSelectedAttributes(variationState.selectedAttributes);
    setSelectedAttributeValues(variationState.selectedAttributeValues);
    setVariants(variationState.variants);
    setSeo(initialSeo);
    setSlugTouched(Boolean(initialSlug));

    setLocalImages(
      initialImages.slice(0, MAX_PRODUCT_IMAGES).map((imagePath, index) => ({
        id: `remote-${activeProductId || "product"}-${index + 1}`,
        name: `Current image ${index + 1}`,
        url: resolveAssetUrl(imagePath),
        file: null,
        remote: true,
        storedUrl: imagePath,
      }))
    );
  }, [isEdit, productQuery.data]);

  useEffect(() => {
    localImagesRef.current = localImages;
  }, [localImages]);

  useEffect(() => {
    return () => {
      localImagesRef.current.forEach((image) => {
        if (!image.remote && image.url) URL.revokeObjectURL(image.url);
      });
    };
  }, []);

  useEffect(() => {
    const targetAttributes = selectedAttributes.filter((entry) => !attributeValuesMap[entry.id]);
    if (targetAttributes.length === 0) return undefined;

    let cancelled = false;
    setAttributeValuesLoading(true);

    Promise.all(
      targetAttributes.map(async (attribute) => {
        const response = await fetchAdminAttributeValues(attribute.id);
        const items = Array.isArray(response?.data) ? response.data : [];
        return [
          attribute.id,
          items.map((item) => ({
            id: item?.id ?? null,
            label: String(item?.value || "").trim(),
            value: String(item?.value || "").trim(),
          })),
        ];
      })
    )
      .then((entries) => {
        if (cancelled) return;
        setAttributeValuesMap((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        setNotice({
          type: "error",
          message: error?.response?.data?.message || "Failed to load attribute values.",
        });
      })
      .finally(() => {
        if (!cancelled) setAttributeValuesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attributeValuesMap, selectedAttributes]);

  const createMutation = useMutation({
    mutationFn: createAdminProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      handleSubmitSuccess();
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to create product.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, payload }) => updateAdminProduct(productId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-product", activeProductId] });
      handleSubmitSuccess();
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to update product.",
      });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const addFiles = async (files) => {
    const incomingFiles = Array.from(files || []);
    if (incomingFiles.length === 0) return;

    const existingIds = new Set(localImages.map((item) => item.id));
    const availableSlots = Math.max(0, MAX_PRODUCT_IMAGES - localImages.length);

    if (availableSlots <= 0) {
      setNotice({
        type: "error",
        message: `You can upload up to ${MAX_PRODUCT_IMAGES} product images.`,
      });
      return;
    }

    const nextImages = [];
    let rejectedTypeCount = 0;
    let rejectedSquareCount = 0;
    let skippedDuplicateCount = 0;
    let skippedOverflowCount = 0;

    for (const file of incomingFiles) {
      if (nextImages.length >= availableSlots) {
        skippedOverflowCount += 1;
        continue;
      }
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        rejectedTypeCount += 1;
        continue;
      }

      const idValue = `${file.name}-${file.size}-${file.lastModified}`;
      if (existingIds.has(idValue) || nextImages.some((item) => item.id === idValue)) {
        skippedDuplicateCount += 1;
        continue;
      }

      try {
        const { width, height } = await readImageDimensions(file);
        if (width <= 0 || height <= 0 || width !== height) {
          rejectedSquareCount += 1;
          continue;
        }
      } catch {
        rejectedSquareCount += 1;
        continue;
      }

      nextImages.push({
        id: idValue,
        name: file.name,
        url: URL.createObjectURL(file),
        file,
        remote: false,
        storedUrl: null,
      });
    }

    if (nextImages.length > 0) {
      setLocalImages((prev) => [...prev, ...nextImages]);
    }

    const messageParts = [];
    if (rejectedTypeCount > 0) {
      messageParts.push(`${rejectedTypeCount} file harus JPG, PNG, atau WEBP`);
    }
    if (rejectedSquareCount > 0) {
      messageParts.push(`${rejectedSquareCount} file ditolak karena bukan rasio 1:1`);
    }
    if (skippedDuplicateCount > 0) {
      messageParts.push(`${skippedDuplicateCount} file duplikat dilewati`);
    }
    if (skippedOverflowCount > 0) {
      messageParts.push(`${skippedOverflowCount} file melebihi batas ${MAX_PRODUCT_IMAGES} gambar`);
    }

    if (messageParts.length > 0) {
      setNotice({
        type: nextImages.length > 0 ? "warning" : "error",
        message: messageParts.join(". "),
      });
      return;
    }

    setNotice(null);
  };

  const removeImage = (imageId) => {
    setLocalImages((prev) => {
      const target = prev.find((item) => item.id === imageId);
      if (target && !target.remote && target.url) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((item) => item.id !== imageId);
    });
  };

  const uploadSelectedImages = async () => {
    const fileItems = localImages.filter((item) => !item.remote && item.file);
    const uploadedUrlsById = new Map();
    for (const item of fileItems) {
      const response = await uploadAdminImage(item.file);
      const url = response?.url || response?.data?.url;
      if (url) uploadedUrlsById.set(item.id, url);
    }
    return localImages
      .map((item) => {
        if (item.remote) return item.storedUrl || null;
        return uploadedUrlsById.get(item.id) || null;
      })
      .filter(Boolean)
      .slice(0, MAX_PRODUCT_IMAGES);
  };

  const onToggleCategory = (categoryId) => {
    setForm((prev) => {
      const nextCategoryIds = prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((entry) => entry !== categoryId)
        : [...prev.categoryIds, categoryId];

      return {
        ...prev,
        categoryIds: normalizeSelectedCategoryIds(nextCategoryIds),
        defaultCategoryId: resolveDefaultCategoryId(
          nextCategoryIds,
          prev.defaultCategoryId
        ),
      };
    });
  };

  const handleTagKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = String(tagInput || "").trim();
    if (!value) return;
    setForm((prev) => {
      const exists = prev.tags.some((tag) => tag.toLowerCase() === value.toLowerCase());
      if (exists) return prev;
      return { ...prev, tags: [...prev.tags, value] };
    });
    setTagInput("");
  };

  const handleSeoKeywordKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = String(seoKeywordInput || "").trim();
    if (!value) return;
    setSeo((prev) => {
      const exists = prev.keywords.some((keyword) => keyword.toLowerCase() === value.toLowerCase());
      if (exists) return prev;
      return {
        ...prev,
        keywords: [...prev.keywords, value],
      };
    });
    setSeoKeywordInput("");
  };

  const removeSeoKeyword = (targetKeyword) => {
    setSeo((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((keyword) => keyword !== targetKeyword),
    }));
  };

  const handleNameChange = (value) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: !slugTouched ? slugify(value) : prev.slug,
    }));
  };

  const addSelectedAttribute = () => {
    const nextId = Number(pendingAttributeId);
    if (!Number.isInteger(nextId) || nextId <= 0) return;
    const attribute = attributes.find((entry) => Number(entry?.id) === nextId);
    if (!attribute) return;

    setSelectedAttributes((prev) => {
      if (prev.some((entry) => Number(entry.id) === nextId)) return prev;
      return [
        ...prev,
        {
          id: nextId,
          name: String(attribute?.displayName || attribute?.display_name || attribute?.name || "").trim(),
        },
      ];
    });
    setPendingAttributeId("");
  };

  const removeSelectedAttribute = (attributeId) => {
    setSelectedAttributes((prev) => prev.filter((entry) => Number(entry.id) !== Number(attributeId)));
    setSelectedAttributeValues((prev) =>
      prev.filter((entry) => Number(entry.attributeId) !== Number(attributeId))
    );
    setVariants((prev) =>
      prev.filter(
        (variant) =>
          !variant.selections.some((selection) => Number(selection.attributeId) === Number(attributeId))
      )
    );
    setAttributeValueSearch((prev) => {
      const next = { ...prev };
      delete next[attributeId];
      return next;
    });
  };

  const toggleAttributeValue = (attribute, value) => {
    setSelectedAttributeValues((prev) => {
      const existing = prev.find((entry) => Number(entry.attributeId) === Number(attribute.id));
      const nextValues = existing?.values || [];
      const dedupeKey = String(value.id ?? value.value).toLowerCase();
      const alreadySelected = nextValues.some(
        (entry) => String(entry.id ?? entry.value).toLowerCase() === dedupeKey
      );
      const updatedValues = alreadySelected
        ? nextValues.filter((entry) => String(entry.id ?? entry.value).toLowerCase() !== dedupeKey)
        : [...nextValues, value];

      const nextEntry = {
        attributeId: Number(attribute.id),
        values: updatedValues,
      };

      if (!existing) return [...prev, nextEntry];
      return prev.map((entry) =>
        Number(entry.attributeId) === Number(attribute.id) ? nextEntry : entry
      );
    });
  };

  const setAllAttributeValues = (attribute, values) => {
    setSelectedAttributeValues((prev) => {
      const nextEntry = {
        attributeId: Number(attribute.id),
        values,
      };
      const hasExisting = prev.some((entry) => Number(entry.attributeId) === Number(attribute.id));
      if (!hasExisting) return [...prev, nextEntry];
      return prev.map((entry) =>
        Number(entry.attributeId) === Number(attribute.id) ? nextEntry : entry
      );
    });
  };

  const handleGenerateVariants = () => {
    if (selectedAttributes.length === 0) {
      setNotice({ type: "error", message: "Select at least one attribute before generating variants." });
      return;
    }

    const attributesWithValues = selectedAttributes.map((attribute) => {
      const picked = selectedAttributeValues.find(
        (entry) => Number(entry.attributeId) === Number(attribute.id)
      );
      return {
        attribute,
        values: Array.isArray(picked?.values) ? picked.values : [],
      };
    });

    if (attributesWithValues.some((entry) => entry.values.length === 0)) {
      setNotice({
        type: "error",
        message: "Choose at least one value for every selected attribute.",
      });
      return;
    }

    const combinations = buildCartesianProduct(attributesWithValues);
    const existingByKey = new Map(variants.map((entry) => [entry.combinationKey, entry]));
    const nextVariants = combinations.map((selections, index) => {
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
        image: form.imageUrl || null,
      };
    });

    setVariants(nextVariants);
    setNotice({
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
    setVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              [field]: value,
            }
          : variant
      )
    );
  };

  const removeVariant = (variantId) => {
    setVariants((prev) => prev.filter((variant) => variant.id !== variantId));
  };

  const handleVariantImageUpload = async (variantId, file) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setNotice({ type: "error", message: "Variant image must be JPG, PNG, or WEBP." });
      return;
    }

    try {
      setVariantImageUploadingId(variantId);
      const response = await uploadAdminImage(file);
      const url = response?.url || response?.data?.url;
      if (!url) {
        throw new Error("Upload response did not include a file URL.");
      }
      updateVariantField(variantId, "image", url);
    } catch (error) {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to upload variant image.",
      });
    } finally {
      setVariantImageUploadingId(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice(null);

    const name = String(form.name || "").trim();
    const price = Number(form.price);
    const stock = Number(form.stock || 0);
    const salePrice = resolveSalePriceValue(form.salePrice);

    if (!name) {
      setNotice({ type: "error", message: "Product title is required." });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setNotice({ type: "error", message: "Product price must be a valid number." });
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setNotice({ type: "error", message: "Product quantity must be a valid number." });
      return;
    }
    if (salePrice != null && (!Number.isFinite(salePrice) || salePrice < 0)) {
      setNotice({ type: "error", message: "Sale price must be a valid number." });
      return;
    }
    if (salePrice != null && salePrice >= price) {
      setNotice({
        type: "error",
        message: "Sale price must be lower than product price.",
      });
      return;
    }
    if (form.categoryIds.length === 0) {
      setNotice({
        type: "error",
        message: "Select at least one category before saving this product.",
      });
      return;
    }
    if (!form.defaultCategoryId || !form.categoryIds.includes(Number(form.defaultCategoryId))) {
      setNotice({
        type: "error",
        message: "Choose one default category from the selected categories.",
      });
      return;
    }
    if (
      hasVariants &&
      variants.some(
        (variant) =>
          variant.salePrice != null &&
          variant.price != null &&
          Number(variant.salePrice) > Number(variant.price)
      )
    ) {
      setNotice({
        type: "error",
        message: "Variant sale price cannot be greater than variant price.",
      });
      setActiveTab("combination");
      return;
    }

    try {
      const uploadedUrls = await uploadSelectedImages();
      const imageUrl = uploadedUrls[0] || undefined;
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
              image: variant.image || null,
            })),
          }
        : null;
      const seoPayload = {
        metaTitle: String(seo.metaTitle || "").trim(),
        metaDescription: String(seo.metaDescription || "").trim(),
        keywords: seo.keywords
          .map((keyword) => String(keyword || "").trim())
          .filter(Boolean)
          .filter(
            (keyword, index, list) =>
              list.findIndex((entry) => entry.toLowerCase() === keyword.toLowerCase()) === index
          ),
        ogImageUrl: String(seo.ogImageUrl || "").trim(),
      };

      const payload = {
        name,
        description: form.description || undefined,
        price,
        salePrice: salePrice ?? undefined,
        stock,
        status: form.status,
        categoryIds: normalizeSelectedCategoryIds(form.categoryIds),
        defaultCategoryId: Number(form.defaultCategoryId),
        categoryId: Number(form.defaultCategoryId),
        imageUrl,
        imageUrls: uploadedUrls,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        slug: form.slug || slugify(name),
        tags: form.tags.length > 0 ? form.tags : undefined,
        seo: seoPayload,
        variations: variationPayload,
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ productId: activeProductId, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to submit product.",
      });
    }
  };

  return (
    <div
      className={
        isDrawerMode
          ? "h-full bg-white"
          : "space-y-5 rounded-2xl bg-slate-50/70 p-4 md:p-6"
      }
    >
        <div
          className={`bg-white ${
            isDrawerMode
              ? "flex h-full min-h-0 flex-col rounded-none border-0 shadow-none"
              : "overflow-hidden rounded-xl border border-slate-200 shadow-[0_6px_20px_-16px_rgba(15,23,42,0.3)]"
          }`}
        >
        <div className="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-5 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold leading-tight text-slate-900">
                {isEdit ? "Update Products" : "Add Product"}
              </h1>
              <p className="text-sm text-slate-500">
                {isEdit
                  ? "Update products info, combinations and extras."
                  : "Add your product and necessary information from here"}
              </p>
            </div>
            <div className="flex items-center gap-3 self-start md:self-auto">
              {isDrawerMode ? (
                <select
                  defaultValue="en"
                  className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm text-slate-700 outline-none"
                  aria-label="Language"
                >
                  <option value="en">en</option>
                </select>
              ) : null}
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 transition hover:bg-rose-100"
                aria-label="Close add product page"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {notice ? (
          <div
            className={`mx-4 mt-4 rounded-xl border px-4 py-2 text-sm sm:mx-5 md:mx-6 ${
              notice.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className={
            isDrawerMode
              ? "flex min-h-0 flex-1 flex-col px-4 pb-0 pt-4 sm:px-5 md:px-6"
              : "px-4 pb-0 pt-4 sm:px-5 md:px-6"
          }
        >
          <div
            className={
              isDrawerMode ? "min-h-0 flex-1 overflow-y-auto pb-4 sm:pr-1" : "pb-4"
            }
          >
            {isEdit && productQuery.isLoading ? (
              <div className="flex min-h-[320px] items-center justify-center py-10 text-sm text-slate-500">
                Loading product details...
              </div>
            ) : null}
            {isEdit && productQuery.isLoading ? null : (
              <div className="space-y-5">
                <div
                  className={`flex flex-col gap-3 ${
                    isDrawerMode ? "border-b border-slate-200 pb-0" : "rounded-2xl border border-slate-200 bg-white p-2"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                      {visibleTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`inline-flex h-10 shrink-0 items-center justify-center border-b-2 px-4 text-sm font-semibold transition ${
                            activeTab === tab.id
                              ? "border-emerald-600 text-emerald-700"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    {isDrawerMode ? (
                      <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:flex-nowrap sm:justify-start">
                        <span className="text-sm font-medium text-orange-500 sm:whitespace-nowrap">
                          Does this product have variants?
                        </span>
                        <button
                          type="button"
                          onClick={() => setHasVariants((prev) => !prev)}
                          className={`relative inline-flex h-8 w-[66px] items-center rounded-full px-1 transition ${
                            hasVariants ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                          aria-label="Toggle variants"
                        >
                          <span
                            className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                              hasVariants ? "translate-x-[34px]" : "translate-x-0"
                            }`}
                          />
                          <span className="absolute right-2 text-sm font-semibold text-white">
                            {hasVariants ? "Yes" : "No"}
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                {activeTab === "basic" ? (
                  <>
                <section className={activeSectionClass}>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <FormRow label="Product Title/Name">
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(event) => handleNameChange(event.target.value)}
                          placeholder="Product Title/Name"
                          className={fieldInputClass}
                        />
                      </FormRow>
                    </div>
                    <div className="lg:col-span-2">
                      <FormRow label="Product Description">
                        <textarea
                          value={form.description}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, description: event.target.value }))
                          }
                          placeholder="Product Description"
                          rows={4}
                          className={fieldTextareaClass}
                        />
                      </FormRow>
                    </div>
                    <FormRow label="Product SKU">
                      <input
                        type="text"
                        value={form.sku}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, sku: event.target.value }))
                        }
                        placeholder="Product SKU"
                        className={fieldInputClass}
                      />
                    </FormRow>
                    <FormRow label="Product Barcode">
                      <input
                        type="text"
                        value={form.barcode}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, barcode: event.target.value }))
                        }
                        placeholder="Product Barcode"
                        className={fieldInputClass}
                      />
                    </FormRow>
                  </div>
                </section>

                <section className={activeSectionClass}>
                  {showCompactSectionHeaders ? (
                    <SectionHeader
                      eyebrow="Placement"
                      title="Category"
                      description="Assign category placement for storefront navigation."
                      meta={
                        <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
                          {selectedCategoryLabel}
                        </span>
                      }
                    />
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-2">
                      <div className="lg:col-span-2">
                        <FormRow label="Category">
                        <div className="space-y-2">
                          <input
                            type="text"
                            readOnly
                            value={selectedCategories.map((category) => category.name).join(", ")}
                            placeholder="Select one or more categories"
                            className={fieldInputClass}
                          />
                          {selectedCategories.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedCategories.map((category) => (
                                <span
                                  key={category.id}
                                  className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700"
                                >
                                  {category.name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                            <CategoryTree
                              tree={categoryTree}
                              selectedIds={form.categoryIds}
                              onToggle={onToggleCategory}
                            />
                          </div>
                        </div>
                      </FormRow>
                    </div>
                      <FormRow label="Default Category">
                      <select
                        value={form.defaultCategoryId ? String(form.defaultCategoryId) : ""}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            defaultCategoryId: event.target.value
                              ? Number(event.target.value)
                              : null,
                          }))
                        }
                        disabled={defaultCategoryOptions.length === 0}
                        className={fieldInputClass}
                      >
                        <option value="">Default Category</option>
                        {defaultCategoryOptions.map((category) => (
                          <option key={category.id} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </FormRow>
                  </div>
                </section>

                <section className={activeSectionClass}>
                  {showCompactSectionHeaders ? (
                    <SectionHeader
                      eyebrow="Commercial"
                      title="Pricing"
                      description="Configure base price first. Sale price is optional and must stay lower."
                      meta={
                        <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                          Base + promo pricing
                        </span>
                      }
                    />
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormRow label="Product Price">
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <span className="inline-flex h-11 w-14 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          Rp
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={form.price}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, price: event.target.value }))
                          }
                          className="h-11 w-full bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </div>
                    </FormRow>

                    <FormRow label="Sale Price">
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <span className="inline-flex h-11 w-14 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          Rp
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.salePrice}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, salePrice: event.target.value }))
                          }
                          className="h-11 w-full bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </div>
                    </FormRow>
                  </div>
                </section>

                <section className={activeSectionClass}>
                  {showCompactSectionHeaders ? (
                    <SectionHeader
                      eyebrow="Operations"
                      title="Inventory"
                      description="Manage stock, status, and product slug settings."
                    />
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormRow label="Product Quantity">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={form.stock}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, stock: event.target.value }))
                        }
                        className={fieldInputClass}
                      />
                    </FormRow>

                    <FormRow label="Product Slug">
                      <input
                        type="text"
                        value={form.slug}
                        onChange={(event) => {
                          setSlugTouched(true);
                          setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }));
                        }}
                        placeholder="Product Slug"
                        className={fieldInputClass}
                      />
                    </FormRow>
                  </div>
                </section>

                <section className={activeSectionClass}>
                  {showCompactSectionHeaders ? (
                    <SectionHeader
                      eyebrow="Media"
                      title="Images"
                      description="Upload product visuals and review selected previews."
                      meta={
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                          {localImages.length}/{MAX_PRODUCT_IMAGES} image(s)
                        </span>
                      }
                    />
                  ) : null}
                  <FormRow label="Product Images">
                    <div className="space-y-3">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragActive(false);
                          void addFiles(event.dataTransfer.files);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        className={`flex h-[170px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center transition ${
                          dragActive
                            ? "border-emerald-400 bg-emerald-50"
                            : "border-slate-300 bg-white hover:border-slate-400"
                        }`}
                      >
                        <UploadCloud className="mb-2 h-8 w-8 text-emerald-500" />
                        <p className="text-base font-medium leading-tight text-slate-700">
                          Drag your images here
                        </p>
                        <p className="mt-2 text-xs italic text-slate-500">
                          (Only *.jpeg, *.webp and *.png images will be accepted)
                        </p>
                        <p className="mt-2 text-[11px] font-medium text-slate-500">
                          Up to {MAX_PRODUCT_IMAGES} images. Square 1:1 previews are recommended.
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          void addFiles(event.target.files);
                          event.target.value = "";
                        }}
                        className="hidden"
                      />
                      {localImages.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                          {localImages.map((image) => (
                            <div
                              key={image.id}
                              className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                            >
                              <img
                                src={image.url}
                                alt={image.name}
                                className="h-full w-full object-cover"
                              />
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/50 via-slate-900/0 to-transparent px-2 py-2 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                                {image.remote ? "Saved" : "Ready to upload"}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeImage(image.id)}
                                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-600 hover:bg-white"
                                aria-label="Remove image"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </FormRow>
                </section>

                <section className={activeSectionClass}>
                  {showCompactSectionHeaders ? (
                    <SectionHeader
                      eyebrow="Discovery"
                      title="Metadata"
                      description="Keep slug and tags organized for search and display."
                      meta={
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                          {form.tags.length} tag(s)
                        </span>
                      }
                    />
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <FormRow label="Product Tags">
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(event) => setTagInput(event.target.value)}
                            onKeyDown={handleTagKeyDown}
                            className={fieldInputClass}
                            placeholder="Product Tag (Write then press enter to add new tag)"
                          />
                          {form.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {form.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setForm((prev) => ({
                                        ...prev,
                                        tags: prev.tags.filter((item) => item !== tag),
                                      }))
                                    }
                                    className="text-emerald-700 hover:text-emerald-900"
                                    aria-label={`Remove ${tag}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </FormRow>
                    </div>
                  </div>
                </section>
                  </>
                ) : null}
                {activeTab === "combination" ? (
                  <section className={activeSectionClass}>
                    <div className="space-y-5">
                      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-base font-semibold text-slate-900">Combination</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Configure variant attributes and generate editable combinations.
                          </p>
                        </div>
                        {!isDrawerMode ? (
                          <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:flex-nowrap sm:justify-start">
                            <span className="text-sm font-medium text-orange-500 sm:whitespace-nowrap">
                              Does this product have variants?
                            </span>
                            <button
                              type="button"
                              onClick={() => setHasVariants((prev) => !prev)}
                              className={`relative inline-flex h-8 w-[66px] items-center rounded-full px-1 transition ${
                                hasVariants ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                              aria-label="Toggle variants"
                            >
                              <span
                                className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                                  hasVariants ? "translate-x-[34px]" : "translate-x-0"
                                }`}
                              />
                              <span className="absolute right-2 text-sm font-semibold text-white">
                                {hasVariants ? "Yes" : "No"}
                              </span>
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {!hasVariants ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          Turn variants on to configure attributes, values, and generated combinations.
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  value={attributeSearch}
                                  onChange={(event) => setAttributeSearch(event.target.value)}
                                  placeholder="Search attributes"
                                  className={fieldInputClass}
                                />
                              </div>
                              <div className="flex flex-col gap-3 sm:flex-row">
                                <select
                                  value={pendingAttributeId}
                                  onChange={(event) => setPendingAttributeId(event.target.value)}
                                  className={fieldInputClass}
                                >
                                  <option value="">Select attribute</option>
                                  {availableAttributes.map((attribute) => (
                                    <option key={attribute.id} value={String(attribute.id)}>
                                      {attribute.displayName || attribute.display_name || attribute.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={addSelectedAttribute}
                                  disabled={!pendingAttributeId}
                                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Add attribute
                                </button>
                              </div>
                              {selectedAttributes.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {selectedAttributes.map((attribute) => (
                                    <span
                                      key={attribute.id}
                                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                    >
                                      {attribute.name}
                                      <button
                                        type="button"
                                        onClick={() => removeSelectedAttribute(attribute.id)}
                                        className="text-emerald-700 hover:text-emerald-900"
                                        aria-label={`Remove ${attribute.name}`}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">
                                  Select one or more attributes to start building variants.
                                </p>
                              )}
                            </div>

                            <div className="space-y-4">
                              {selectedAttributes.map((attribute) => {
                                const allValues = Array.isArray(attributeValuesMap[attribute.id])
                                  ? attributeValuesMap[attribute.id]
                                  : [];
                                const currentSearch = String(attributeValueSearch[attribute.id] || "")
                                  .trim()
                                  .toLowerCase();
                                const filteredValues = allValues.filter((value) =>
                                  String(value?.label || value?.value || "")
                                    .toLowerCase()
                                    .includes(currentSearch)
                                );
                                const selectedEntry =
                                  selectedAttributeValues.find(
                                    (entry) => Number(entry.attributeId) === Number(attribute.id)
                                  ) || null;
                                const selectedValueKeys = new Set(
                                  (selectedEntry?.values || []).map((value) =>
                                    String(value.id ?? value.value).toLowerCase()
                                  )
                                );

                                return (
                                  <div
                                    key={attribute.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4"
                                  >
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">
                                          Select {attribute.name}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          Choose the values to include in generated variants.
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setAllAttributeValues(attribute, filteredValues)}
                                        className="text-xs font-semibold text-indigo-500 hover:text-indigo-600"
                                      >
                                        Select All
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      value={attributeValueSearch[attribute.id] || ""}
                                      onChange={(event) =>
                                        setAttributeValueSearch((prev) => ({
                                          ...prev,
                                          [attribute.id]: event.target.value,
                                        }))
                                      }
                                      placeholder={`Search ${attribute.name} values`}
                                      className={fieldInputClass}
                                    />
                                    <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                                      {filteredValues.map((value) => {
                                        const dedupeKey = String(value.id ?? value.value).toLowerCase();
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
                                      {!attributeValuesLoading && filteredValues.length === 0 ? (
                                        <p className="text-sm text-slate-500">No values available.</p>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                            <button
                              type="button"
                              onClick={handleClearVariants}
                              disabled={variants.length === 0}
                              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                              Clear Variants
                            </button>
                            <button
                              type="button"
                              onClick={handleGenerateVariants}
                              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:w-auto"
                            >
                              Generate Variants
                            </button>
                          </div>

                          <div className="-mx-4 overflow-hidden rounded-2xl border border-slate-200 sm:mx-0">
                            <div className="overflow-x-auto px-4 sm:px-0">
                              <table className="min-w-[860px] divide-y divide-slate-200 lg:min-w-[980px]">
                                <thead className="bg-slate-50">
                                  <tr>
                                    {["Image", "Combination", "SKU", "Barcode", "Price", "Sale Price", "Quantity", "Action"].map((label) => (
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
                                        Generate variants to review and edit each combination.
                                      </td>
                                    </tr>
                                  ) : (
                                    variants.map((variant) => (
                                      <tr key={variant.id}>
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
                                              {variantImageUploadingId === variant.id ? "Uploading..." : "Change"}
                                              <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                className="hidden"
                                                onChange={(event) =>
                                                  handleVariantImageUpload(
                                                    variant.id,
                                                    event.target.files?.[0] || null
                                                  )
                                                }
                                              />
                                            </label>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                          {variant.combination}
                                        </td>
                                        <td className="px-4 py-3">
                                          <input
                                            type="text"
                                            value={variant.sku}
                                            onChange={(event) =>
                                              updateVariantField(variant.id, "sku", event.target.value)
                                            }
                                            placeholder="Sku"
                                            className={fieldInputClass}
                                          />
                                        </td>
                                        <td className="px-4 py-3">
                                          <input
                                            type="text"
                                            value={variant.barcode}
                                            onChange={(event) =>
                                              updateVariantField(variant.id, "barcode", event.target.value)
                                            }
                                            placeholder="Barcode"
                                            className={fieldInputClass}
                                          />
                                        </td>
                                        <td className="px-4 py-3">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={variant.price ?? ""}
                                            onChange={(event) =>
                                              updateVariantField(variant.id, "price", event.target.value)
                                            }
                                            className={fieldInputClass}
                                          />
                                        </td>
                                        <td className="px-4 py-3">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={variant.salePrice ?? ""}
                                            onChange={(event) =>
                                              updateVariantField(variant.id, "salePrice", event.target.value)
                                            }
                                            className={fieldInputClass}
                                          />
                                        </td>
                                        <td className="px-4 py-3">
                                          <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={variant.quantity ?? ""}
                                            onChange={(event) =>
                                              updateVariantField(variant.id, "quantity", event.target.value)
                                            }
                                            className={fieldInputClass}
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
                        </>
                      )}
                    </div>
                  </section>
                ) : null}
                {activeTab === "seo" ? (
                  <section className={activeSectionClass}>
                    <div className="space-y-5">
                      <div className="border-b border-slate-100 pb-4">
                        <p className="text-base font-semibold text-slate-900">SEO</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Configure search metadata and review how this product will appear by default.
                        </p>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:items-start">
                        <div className="min-w-0 space-y-4">
                          <FormRow label="Meta Title" helper="Leave empty to use the product title.">
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={seo.metaTitle}
                                onChange={(event) =>
                                  setSeo((prev) => ({ ...prev, metaTitle: event.target.value }))
                                }
                                placeholder="Custom SEO title"
                                className={fieldInputClass}
                              />
                              <p className="text-right text-xs text-slate-400">
                                {seo.metaTitle.trim().length} / 255
                              </p>
                            </div>
                          </FormRow>

                          <FormRow
                            label="Meta Description"
                            helper="Leave empty to use the product description."
                          >
                            <div className="space-y-2">
                              <textarea
                                value={seo.metaDescription}
                                onChange={(event) =>
                                  setSeo((prev) => ({
                                    ...prev,
                                    metaDescription: event.target.value,
                                  }))
                                }
                                placeholder="Custom SEO description"
                                rows={5}
                                className={fieldTextareaClass}
                              />
                              <p className="text-right text-xs text-slate-400">
                                {seo.metaDescription.trim().length} / 1000
                              </p>
                            </div>
                          </FormRow>

                          <FormRow
                            label="SEO Keywords"
                            helper="Press Enter to add a keyword. Duplicate keywords are ignored."
                          >
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={seoKeywordInput}
                                onChange={(event) => setSeoKeywordInput(event.target.value)}
                                onKeyDown={handleSeoKeywordKeyDown}
                                placeholder="Type and press Enter to add SEO keywords"
                                className={fieldInputClass}
                              />
                              {seo.keywords.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {seo.keywords.map((keyword) => (
                                    <span
                                      key={keyword}
                                      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                                    >
                                      <span className="min-w-0 break-all">{keyword}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeSeoKeyword(keyword)}
                                        className="shrink-0 text-indigo-700 hover:text-indigo-900"
                                        aria-label={`Remove ${keyword}`}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">
                                  No SEO keywords added yet.
                                </p>
                              )}
                            </div>
                          </FormRow>

                          <FormRow
                            label="OG Image URL"
                            helper="Leave empty to use the product's main image."
                          >
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={seo.ogImageUrl}
                                onChange={(event) =>
                                  setSeo((prev) => ({ ...prev, ogImageUrl: event.target.value }))
                                }
                                placeholder="https://example.com/og-image.jpg or /uploads/..."
                                className={fieldInputClass}
                              />
                              {seoOgImageWarning ? (
                                <p className="text-xs text-amber-600">{seoOgImageWarning}</p>
                              ) : null}
                            </div>
                          </FormRow>
                        </div>

                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                          <p className="text-sm font-semibold text-slate-900">SEO Preview</p>
                          <div className="mt-3 min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.45)] sm:p-4">
                            <p className="line-clamp-2 text-base font-semibold text-blue-700 sm:text-lg">
                              {seoPreview.title}
                            </p>
                            <p className="mt-1 break-all text-sm text-emerald-700">
                              {seoPreview.url}
                            </p>
                            <p className="mt-2 line-clamp-3 text-sm text-slate-500">
                              {seoPreview.description}
                            </p>
                          </div>
                          <dl className="mt-4 space-y-3 text-sm">
                            <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                                Title Source
                              </dt>
                              <dd className="mt-1 text-slate-700">
                                {seo.metaTitle.trim() ? "Custom meta title" : "Product name fallback"}
                              </dd>
                            </div>
                            <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                                Description Source
                              </dt>
                              <dd className="mt-1 text-slate-700">
                                {seo.metaDescription.trim()
                                  ? "Custom meta description"
                                  : "Product description fallback"}
                              </dd>
                            </div>
                            <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                                Image Source
                              </dt>
                              <dd className="mt-1 break-all text-slate-700">
                                {seoPreview.imageSource || "No image selected yet"}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>

          <div
            className={`-mx-4 mt-0 shrink-0 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-5 sm:px-5 md:-mx-6 md:px-6 ${
              isDrawerMode ? "sticky bottom-0 shadow-[0_-8px_24px_-20px_rgba(15,23,42,0.45)]" : ""
            }`}
          >
            <div className="grid grid-cols-1 gap-3 sm:ml-auto sm:max-w-[520px] sm:grid-cols-2">
              {isDrawerMode ? (
                <button
                  type="button"
                  onClick={closeForm}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Cancel
                </button>
              ) : (
                <Link
                  to="/admin/catalog/products"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                >
                  Cancel
                </Link>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isEdit
                    ? "bg-amber-500 shadow-[0_14px_26px_-18px_rgba(245,158,11,0.65)] hover:bg-amber-600"
                    : "bg-emerald-600 shadow-[0_14px_26px_-18px_rgba(5,150,105,0.7)] hover:bg-emerald-700"
                }`}
              >
                {isSubmitting
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                    ? "Update Product"
                    : "Add Product"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

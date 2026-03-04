import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminProduct,
  fetchAdminCategories,
  fetchAdminProduct,
  updateAdminProduct,
  uploadAdminImage,
} from "../../lib/adminApi.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { ChevronDown, ChevronRight, UploadCloud, X } from "lucide-react";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

const fieldInputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100";
const fieldTextareaClass =
  "h-32 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100";
const sectionCardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const sectionTitleClass = "text-base font-semibold text-slate-900";

function FormRow({ label, helper, children }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function CategoryTree({ tree, selectedId, onSelect }) {
  const [expanded, setExpanded] = useState(() => new Set());

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
              type="radio"
              name="category-tree"
              checked={String(selectedId || "") === String(nodeId)}
              onChange={() => onSelect(String(nodeId))}
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
  const [hasVariants, setHasVariants] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [localImages, setLocalImages] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    sku: "",
    barcode: "",
    categoryId: "",
    defaultCategoryId: "",
    price: "",
    salePrice: "",
    stock: "",
    slug: "",
    tags: [],
    status: "active",
    imageUrl: "",
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories-add-product"],
    queryFn: () => fetchAdminCategories({ page: 1, limit: 200 }),
  });
  const productQuery = useQuery({
    queryKey: ["admin-product", activeProductId],
    queryFn: () => fetchAdminProduct(activeProductId),
    enabled: isEdit,
  });

  const categories = categoriesQuery.data?.data || [];
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const closeForm = () => {
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    navigate("/admin/products", { replace: true });
  };
  const handleSubmitSuccess = () => {
    if (typeof onSuccess === "function") onSuccess();
    closeForm();
  };

  useEffect(() => {
    if (!isEdit) return;
    const product = productQuery.data?.data;
    if (!product) return;

    const initialName = String(product.name || "");
    const initialSlug = String(product.slug || "");
    const initialCategoryId = String(product.categoryId || "");
    const initialImage =
      product.promoImagePath ||
      (Array.isArray(product.imagePaths) ? product.imagePaths[0] : "") ||
      product.imageUrl ||
      "";
    const initialTags = Array.isArray(product.tags)
      ? product.tags.map((tag) => String(tag))
      : [];

    setForm({
      name: initialName,
      description: product.description || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      categoryId: initialCategoryId,
      defaultCategoryId: initialCategoryId,
      price: String(product.price ?? ""),
      salePrice: String(product.salePrice ?? ""),
      stock: String(product.stock ?? ""),
      slug: initialSlug,
      tags: initialTags,
      status: product.status || "active",
      imageUrl: initialImage,
    });
    setSlugTouched(Boolean(initialSlug));

    if (initialImage) {
      setLocalImages([
        {
          id: `remote-${Date.now()}`,
          name: "Current image",
          url: resolveAssetUrl(initialImage),
          file: null,
          remote: true,
        },
      ]);
    }
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

  const addFiles = (files) => {
    const nextImages = [];
    Array.from(files || []).forEach((file) => {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return;
      const idValue = `${file.name}-${file.size}-${file.lastModified}`;
      const alreadyExists = localImages.some((item) => item.id === idValue);
      if (alreadyExists) return;
      nextImages.push({
        id: idValue,
        name: file.name,
        url: URL.createObjectURL(file),
        file,
        remote: false,
      });
    });

    if (nextImages.length > 0) {
      setLocalImages((prev) => [...prev, ...nextImages]);
    }
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
    if (fileItems.length === 0) return [];

    const uploadedUrls = [];
    for (const item of fileItems) {
      const response = await uploadAdminImage(item.file);
      const url = response?.url || response?.data?.url;
      if (url) uploadedUrls.push(url);
    }
    return uploadedUrls;
  };

  const onSelectCategory = (categoryId) => {
    setForm((prev) => ({
      ...prev,
      categoryId,
      defaultCategoryId: prev.defaultCategoryId || categoryId,
    }));
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

  const handleNameChange = (value) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: !slugTouched ? slugify(value) : prev.slug,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice(null);

    const name = String(form.name || "").trim();
    const price = Number(form.price);
    const stock = Number(form.stock || 0);
    const salePrice =
      String(form.salePrice || "").trim() === "" ? null : Number(form.salePrice);

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

    try {
      const uploadedUrls = await uploadSelectedImages();
      const imageUrl = uploadedUrls[0] || form.imageUrl || undefined;

      const payload = {
        name,
        description: form.description || undefined,
        price,
        salePrice: salePrice ?? undefined,
        stock,
        status: form.status,
        categoryId: form.categoryId ? Number(form.categoryId) : undefined,
        defaultCategoryId: form.defaultCategoryId
          ? Number(form.defaultCategoryId)
          : undefined,
        imageUrl,
        imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        slug: form.slug || slugify(name),
        tags: form.tags.length > 0 ? form.tags : undefined,
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
        <div className="shrink-0 border-b border-slate-200 px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Admin / Products / {isEdit ? "Edit" : "Add"}
              </p>
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                {isEdit ? "Edit Product" : "Add Product"}
              </h1>
              <p className="text-sm text-slate-600">
                Create and manage product information with consistent catalog details.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start md:self-auto">
              <select className="h-10 min-w-[82px] rounded-[10px] border border-emerald-500 bg-white px-3 text-sm font-medium text-slate-700 focus:outline-none">
                <option value="en">en</option>
              </select>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-rose-500 shadow-[0_6px_14px_-8px_rgba(15,23,42,0.3)] transition hover:bg-slate-50"
                aria-label="Close add product page"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {notice ? (
          <div
            className={`mx-5 mt-4 rounded-xl border px-4 py-2 text-sm md:mx-6 ${
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
              ? "flex min-h-0 flex-1 flex-col px-5 pb-0 pt-4 md:px-6"
              : "px-5 pb-0 pt-4 md:px-6"
          }
        >
          <div
            className={
              isDrawerMode ? "min-h-0 flex-1 overflow-y-auto pb-4 pr-1" : "pb-4"
            }
          >
            {isEdit && productQuery.isLoading ? (
              <div className="flex min-h-[320px] items-center justify-center py-10 text-sm text-slate-500">
                Loading product details...
              </div>
            ) : null}
            {isEdit && productQuery.isLoading ? null : (
              <div className="space-y-5">
                <section className={sectionCardClass}>
                  <div className="mb-4">
                    <h2 className={sectionTitleClass}>Basic Info</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Set product identity and primary descriptive information.
                    </p>
                  </div>
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

                <section className={sectionCardClass}>
                  <div className="mb-4">
                    <h2 className={sectionTitleClass}>Category</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Assign category placement for storefront navigation.
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <FormRow label="Category">
                        <div className="space-y-2">
                          <input
                            type="text"
                            readOnly
                            value={
                              categories.find((cat) => String(cat.id) === String(form.categoryId))
                                ?.name || ""
                            }
                            placeholder="Select Category"
                            className={fieldInputClass}
                          />
                          <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                            <CategoryTree
                              tree={categoryTree}
                              selectedId={form.categoryId}
                              onSelect={onSelectCategory}
                            />
                          </div>
                        </div>
                      </FormRow>
                    </div>
                    <FormRow label="Default Category">
                      <select
                        value={form.defaultCategoryId}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, defaultCategoryId: event.target.value }))
                        }
                        className={fieldInputClass}
                      >
                        <option value="">Default Category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </FormRow>
                  </div>
                </section>

                <section className={sectionCardClass}>
                  <div className="mb-4">
                    <h2 className={sectionTitleClass}>Pricing</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Configure base and sale price presentation.
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormRow label="Product Price">
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <span className="inline-flex h-10 w-14 items-center justify-center border-r border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500">
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
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <span className="inline-flex h-10 w-14 items-center justify-center border-r border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500">
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

                <section className={sectionCardClass}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className={sectionTitleClass}>Inventory</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Manage stock and variant-related display settings.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-orange-500">
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
                  </div>
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

                <section className={sectionCardClass}>
                  <div className="mb-4">
                    <h2 className={sectionTitleClass}>Images</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Upload product visuals and review selected previews.
                    </p>
                  </div>
                  <FormRow label="Product Images">
                    <div className="space-y-3">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragActive(false);
                          addFiles(event.dataTransfer.files);
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
                        className={`flex h-[170px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                          dragActive
                            ? "border-emerald-400 bg-emerald-50"
                            : "border-slate-300 bg-slate-50 hover:border-slate-400"
                        }`}
                      >
                        <UploadCloud className="mb-2 h-8 w-8 text-emerald-500" />
                        <p className="text-base font-medium leading-tight text-slate-700">
                          Drag your images here
                        </p>
                        <p className="mt-2 text-xs italic text-slate-500">
                          (Only *.jpeg, *.webp and *.png images will be accepted)
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => addFiles(event.target.files)}
                        className="hidden"
                      />
                      {localImages.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {localImages.map((image) => (
                            <div
                              key={image.id}
                              className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                            >
                              <img
                                src={image.url}
                                alt={image.name}
                                className="h-20 w-full object-cover"
                              />
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

                <section className={sectionCardClass}>
                  <div className="mb-4">
                    <h2 className={sectionTitleClass}>Metadata</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Keep slug and tags organized for search and display.
                    </p>
                  </div>
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
              </div>
            )}
          </div>

          <div
            className={`-mx-5 mt-0 grid shrink-0 grid-cols-1 gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:-mx-6 md:grid-cols-2 md:px-6 ${
              isDrawerMode ? "sticky bottom-0 shadow-[0_-8px_24px_-20px_rgba(15,23,42,0.45)]" : ""
            }`}
          >
            {isDrawerMode ? (
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            ) : (
              <Link
                to="/admin/products"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Cancel
              </Link>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        </form>
      </div>
    </div>
  );
}

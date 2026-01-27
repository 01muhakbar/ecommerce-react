import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminCategories,
  fetchAdminProducts,
  toggleAdminProductPublish,
  updateAdminProduct,
  uploadAdminImage,
} from "../lib/adminApi.js";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

const getImageUrl = (product) => {
  if (product?.promoImagePath) return product.promoImagePath;
  if (product?.imageUrl) return product.imageUrl;
  if (Array.isArray(product?.imagePaths) && product.imagePaths.length > 0) {
    return product.imagePaths[0];
  }
  try {
    const parsed = typeof product?.imagePaths === "string" ? JSON.parse(product.imagePaths) : [];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
  } catch {
    return null;
  }
  return null;
};

export default function Products() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [notice, setNotice] = useState("");
  const [publishError, setPublishError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [brokenImages, setBrokenImages] = useState(() => new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    price: "",
    stock: "",
    categoryId: "",
    imageUrl: "",
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const params = useMemo(
    () => ({ page, limit, q: debouncedSearch || undefined, category: category || undefined }),
    [page, limit, debouncedSearch, category]
  );

  const productsQuery = useQuery({
    queryKey: ["admin-products", params],
    queryFn: () => fetchAdminProducts(params),
    keepPreviousData: true,
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => fetchAdminCategories({ page: 1, limit: 100 }),
  });

  const categories = categoriesQuery.data?.data?.items || [];
  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  const createMutation = useMutation({
    mutationFn: createAdminProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["storefront"], exact: false });
      setNotice("Product created.");
      setIsFormOpen(false);
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminProduct(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["storefront"], exact: false });
      setNotice("Product updated.");
      setIsFormOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["storefront"], exact: false });
      setNotice("Product deleted.");
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }) => toggleAdminProductPublish(id, isPublished),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["storefront"], exact: false });
      setNotice("Visibility updated.");
      setPublishError("");
    },
    onError: (error) => {
      setPublishError(
        error?.response?.data?.message || "Failed to update visibility."
      );
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAdminImage,
    onSuccess: (data) => {
      const url = data?.data?.url || data?.url;
      if (url) {
        setForm((prev) => ({ ...prev, imageUrl: url }));
        setUploadError("");
      } else {
        setUploadError("Upload succeeded but no URL returned.");
      }
    },
    onError: (error) => {
      setUploadError(
        error?.response?.data?.message || "Failed to upload image."
      );
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", slug: "", price: "", stock: "", categoryId: "", imageUrl: "" });
    setUploadError("");
    setPublishError("");
    setIsFormOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name: product.name || "",
      slug: product.slug || "",
      price: String(product.price || ""),
      stock: String(product.stock || ""),
      categoryId: String(product.categoryId || ""),
      imageUrl: getImageUrl(product) || "",
    });
    setUploadError("");
    setPublishError("");
    setIsFormOpen(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      price: form.price,
      stock: form.stock || 0,
      categoryId: form.categoryId || undefined,
      imageUrl: form.imageUrl || undefined,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const items = productsQuery.data?.data?.items || [];
  const meta = productsQuery.data?.data?.meta || { page: 1, limit, total: 0 };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  const renderImageCell = (product) => {
    const imageUrl =
      getImageUrl(product) ||
      product?.imageUrl ||
      "/uploads/products/demo.svg";
    const isBroken = brokenImages.has(product.id);
    if (!imageUrl || isBroken) {
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-semibold text-slate-400">
          IMG
        </div>
      );
    }
    return (
      <img
        src={imageUrl}
        alt={product.name}
        className="h-full w-full object-cover"
        onError={() =>
          setBrokenImages((prev) => new Set(prev).add(product.id))
        }
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-slate-500">Manage your catalog in one place.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          New Product
        </button>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {publishError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {publishError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none md:w-64"
        />
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {productsQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading products...
        </div>
      ) : productsQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {(productsQuery.error?.response?.data?.message) || "Failed to load products."}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No products found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                (() => {
                  const isPublished = Boolean(product.isPublished);
                  return (
                <tr key={product.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100">
                      {renderImageCell(product)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                  <td className="px-4 py-3">{currency.format(Number(product.price || 0))}</td>
                  <td className="px-4 py-3">{product.stock ?? 0}</td>
                  <td className="px-4 py-3">
                    {categoryMap.get(product.categoryId) || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        isPublished
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isPublished ? "Published" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          publishMutation.mutate({
                            id: product.id,
                            isPublished: !isPublished,
                          })
                        }
                        disabled={publishMutation.isPending}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs disabled:opacity-50"
                      >
                        {isPublished ? "Hide" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete ${product.name}?`)) {
                            deleteMutation.mutate(product.id);
                          }
                        }}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1"
          disabled={meta.page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </button>
        <span className="text-slate-500">
          Page {meta.page} of {totalPages}
        </span>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1"
          disabled={meta.page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editing ? "Edit Product" : "New Product"}
              </h2>
              <button type="button" onClick={() => setIsFormOpen(false)}>
                ✕
              </button>
            </div>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold text-slate-500">Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Slug (optional)</label>
                <input
                  value={form.slug}
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Price</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Stock</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Image URL</label>
                <input
                  value={form.imageUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        uploadMutation.mutate(file);
                      }
                    }}
                  />
                  {uploadMutation.isPending ? (
                    <span className="text-xs text-slate-500">Uploading...</span>
                  ) : null}
                </div>
                {uploadError ? (
                  <div className="mt-2 text-xs text-rose-600">{uploadError}</div>
                ) : null}
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    className="mt-3 h-20 w-20 rounded-xl object-cover"
                  />
                ) : null}
              </div>
              {createMutation.isError || updateMutation.isError ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {createMutation.error?.response?.data?.message ||
                    updateMutation.error?.response?.data?.message ||
                    "Failed to save product."}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

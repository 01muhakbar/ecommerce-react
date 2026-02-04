import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/axios.ts";
import {
  createAdminProduct,
  fetchAdminCategories,
  fetchAdminProduct,
  updateAdminProduct,
} from "../../lib/adminApi.js";

const STATUS_OPTIONS = ["active", "inactive"];

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    status: "active",
    categoryId: "",
    imageUrl: "",
  });
  const [notice, setNotice] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [attributeSelections, setAttributeSelections] = useState({});
  const [attributeNotice, setAttributeNotice] = useState(null);

  const productQuery = useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => fetchAdminProduct(id),
    enabled: isEdit,
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => fetchAdminCategories({ page: 1, limit: 200 }),
  });
  const categories = categoriesQuery.data?.data || [];
  const attributesQuery = useQuery({
    queryKey: ["admin", "attributes-with-values"],
    queryFn: async () => {
      const { data } = await api.get("/admin/attributes");
      const attributes = data?.data || [];
      const valuesEntries = await Promise.all(
        attributes.map(async (attr) => {
          const { data: valuesData } = await api.get(
            `/admin/attributes/${attr.id}/values`,
          );
          return [attr.id, valuesData?.data || []];
        }),
      );
      const valuesByAttribute = Object.fromEntries(valuesEntries);
      return { attributes, valuesByAttribute, warning: data?.warning || "" };
    },
  });
  const attributes = attributesQuery.data?.attributes || [];
  const valuesByAttribute = attributesQuery.data?.valuesByAttribute || {};
  const attributesWarning = attributesQuery.data?.warning || "";

  const productAttributesQuery = useQuery({
    queryKey: ["admin", "product-attributes", id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/products/${id}/attributes`);
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (!isEdit) return;
    const rows = productAttributesQuery.data?.data || [];
    if (!rows.length) return;
    const next = {};
    rows.forEach((row) => {
      if (row?.attributeId) {
        next[row.attributeId] = row.valueId ? String(row.valueId) : "";
      }
    });
    setAttributeSelections(next);
  }, [isEdit, productAttributesQuery.data]);

  useEffect(() => {
    if (!isEdit) return;
    const product = productQuery.data?.data;
    if (!product) return;
    setForm({
      name: product.name || "",
      description: product.description || "",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      status: product.status || "active",
      categoryId: String(product.categoryId ?? ""),
      imageUrl:
        product.promoImagePath ||
        (Array.isArray(product.imagePaths) ? product.imagePaths[0] : "") ||
        "",
    });
  }, [isEdit, productQuery.data]);

  const createMutation = useMutation({
    mutationFn: createAdminProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setNotice({ type: "success", message: "Product created." });
      navigate("/admin/products", { replace: true });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to create product.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id: productId, payload }) => updateAdminProduct(productId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
      setNotice({ type: "success", message: "Product updated." });
      navigate("/admin/products", { replace: true });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to update product.",
      });
    },
  });

  const saveAttributesMutation = useMutation({
    mutationFn: async ({ productId, items }) => {
      const { data } = await api.put(`/admin/products/${productId}/attributes`, {
        items,
      });
      return data;
    },
    onSuccess: () => {
      setAttributeNotice({ type: "success", message: "Attributes saved." });
      qc.invalidateQueries({ queryKey: ["admin", "product-attributes", id] });
    },
    onError: (error) => {
      setAttributeNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to save attributes.",
      });
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: Number(form.price || 0),
      stock: Number(form.stock || 0),
      status: form.status,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      imageUrl: form.imageUrl || undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/admin/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = data?.url;
      if (url) {
        setForm((prev) => ({ ...prev, imageUrl: url }));
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to upload image.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/admin/products" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to Products
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{isEdit ? "Edit Product" : "New Product"}</h1>
        <p className="text-sm text-slate-500">Fill in product details below.</p>
      </div>

      {notice ? (
        <div
          className={`rounded-2xl px-4 py-2 text-sm ${
            notice.type === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-600">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.price}
              onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Stock</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Status</label>
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Category</label>
            <select
              value={form.categoryId}
              onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
              disabled={categoriesQuery.isLoading || categoriesQuery.isError}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-50"
            >
              <option value="">
                {categoriesQuery.isLoading ? "Loading..." : "Uncategorized"}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
            {categoriesQuery.isError ? (
              <p className="mt-1 text-xs text-slate-400">Failed to load categories.</p>
            ) : null}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleUpload(event.target.files?.[0])}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {form.imageUrl ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <img
              src={form.imageUrl}
              alt="Preview"
              className="h-40 w-40 rounded-lg object-cover"
            />
          </div>
        ) : null}

        <div>
          <label className="text-sm font-medium text-slate-600">Description</label>
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={4}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending || uploading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {uploading
              ? "Uploading..."
              : isEdit
              ? updateMutation.isPending
                ? "Saving..."
                : "Save Changes"
              : createMutation.isPending
              ? "Creating..."
              : "Create Product"}
          </button>
          <Link to="/admin/products" className="text-sm text-slate-500 hover:text-slate-900">
            Cancel
          </Link>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Attributes</h2>
            <p className="text-sm text-slate-500">
              Assign attribute values to this product.
            </p>
          </div>
          <button
            type="button"
            disabled={!isEdit || saveAttributesMutation.isPending}
            onClick={() => {
              const items = Object.entries(attributeSelections)
                .map(([attributeId, valueId]) => ({
                  attributeId: Number(attributeId),
                  valueId: Number(valueId),
                }))
                .filter((item) => item.attributeId > 0 && item.valueId > 0);
              saveAttributesMutation.mutate({ productId: id, items });
            }}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saveAttributesMutation.isPending ? "Saving..." : "Save Attributes"}
          </button>
        </div>

        {attributeNotice ? (
          <div
            className={`mt-4 rounded-2xl px-4 py-2 text-sm ${
              attributeNotice.type === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {attributeNotice.message}
          </div>
        ) : null}

        {attributesWarning ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            Warning: {attributesWarning}
          </div>
        ) : null}

        {!isEdit ? (
          <div className="mt-4 text-sm text-slate-500">
            Save the product first to manage attributes.
          </div>
        ) : attributesQuery.isLoading ? (
          <div className="mt-4 text-sm text-slate-500">Loading attributes...</div>
        ) : attributesQuery.isError ? (
          <div className="mt-4 text-sm text-rose-600">
            {attributesQuery.error?.response?.status === 401
              ? "Unauthorized. Please login as admin."
              : "Failed to load attributes."}
          </div>
        ) : attributes.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">No attributes yet.</div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {attributes.map((attr) => {
              const values = valuesByAttribute[attr.id] || [];
              return (
                <div key={attr.id}>
                  <label className="text-sm font-medium text-slate-600">
                    {attr.name}
                  </label>
                  <select
                    value={attributeSelections[attr.id] || ""}
                    onChange={(event) =>
                      setAttributeSelections((prev) => ({
                        ...prev,
                        [attr.id]: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="">Select value</option>
                    {values.map((val) => (
                      <option key={val.id} value={String(val.id)}>
                        {val.value}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

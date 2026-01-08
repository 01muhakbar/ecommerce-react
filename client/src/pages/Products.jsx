import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import { productService } from "../api/index.ts";
import ProductFilters from "../components/Filters/ProductFilters.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import DataTable from "../components/Tables/DataTable.jsx";
import ProductRow from "../components/Tables/ProductRow.jsx";
import ProductFormModal from "../components/Modals/ProductFormModal.jsx";
import ConfirmDeleteModal from "../components/Modals/ConfirmDeleteModal.jsx";
import ProductTableSkeleton from "../components/Products/ProductTableSkeleton.jsx";
import "./Products.css";

const COLUMNS = [
  {
    key: "select",
    label: <input type="checkbox" />,
    align: "left",
  },
  { key: "product", label: "Product" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price" },
  { key: "salePrice", label: "Sale Price" },
  { key: "stock", label: "Stock" },
  { key: "status", label: "Status" },
  { key: "view", label: "View" },
  { key: "published", label: "Published" },
  { key: "actions", label: "Actions" },
];

const initialFilters = {
  search: "",
  category: "",
  price: "",
  stockStatus: "",
};

export default function Products() {
  // Page-level container for product listing and filters.
  const { user, role } = useAuth();
  const currentRole = role || user?.role;
  const isAdmin = currentRole === "admin" || currentRole === "super_admin";
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [filters.search]);

  useEffect(() => {
    setPage(1);
  }, [filters.category, filters.price, filters.stockStatus]);

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      q: debouncedSearch,
      sort: sortBy,
      order: sortOrder,
      category: filters.category,
      price: filters.price,
      stockStatus: filters.stockStatus,
    }),
    [
      page,
      pageSize,
      debouncedSearch,
      sortBy,
      sortOrder,
      filters.category,
      filters.price,
      filters.stockStatus,
    ]
  );

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await productService.listProducts(queryParams);
      setData(result.data || []);
      setMeta(result.meta || { page: 1, pageSize, total: 0 });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setError("Session expired. Please log in again.");
      } else if (status === 403) {
        setError("You do not have permission to view products.");
      } else if (status === 404) {
        setError("Products endpoint not found.");
      } else {
        setError("Failed to load products.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [queryParams, refreshKey]);
  const handleReset = () => {
    setFilters(initialFilters);
    setPage(1);
    setSortBy("");
    setSortOrder("asc");
  };
  const handleOpenAdd = () => {
    if (!isAdmin) {
      return;
    }
    setIsAddOpen(true);
  };
  const handleAddSave = async (payload) => {
    if (!isAdmin) {
      return;
    }
    await productService.createProduct(payload);
    setIsAddOpen(false);
    setPage(1);
    setRefreshKey((prev) => prev + 1);
    window.alert("Product added successfully.");
  };
  const handleEditClick = (product) => {
    if (!isAdmin) {
      return;
    }
    setEditingProduct(product);
    setIsEditOpen(true);
  };
  const handleEditSave = async (payload) => {
    if (!editingProduct) {
      return;
    }
    if (!isAdmin) {
      return;
    }
    await productService.updateProduct(editingProduct.id, payload);
    setIsEditOpen(false);
    setEditingProduct(null);
    setPage(1);
    setRefreshKey((prev) => prev + 1);
    window.alert("Product updated successfully.");
  };
  const handleDeleteClick = (product) => {
    if (!isAdmin) {
      return;
    }
    setDeleteTarget(product);
    setIsDeleteOpen(true);
  };
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }
    if (!isAdmin) {
      return;
    }
    await productService.deleteProduct(deleteTarget.id);
    setIsDeleteOpen(false);
    setDeleteTarget(null);
    setPage(1);
    setRefreshKey((prev) => prev + 1);
    window.alert("Product deleted successfully.");
  };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="products-page">
      <div className="products-header">
        <h1>Products</h1>
        <div className="products-actions">
          <button className="btn btn--ghost">Export</button>
          <button className="btn btn--ghost">Import</button>
          {isAdmin && (
            <button className="btn btn--ghost">Bulk Action</button>
          )}
          {isAdmin && <button className="btn btn--danger">Delete</button>}
          {isAdmin && (
            <button
              className="btn btn--primary"
              onClick={handleOpenAdd}
              type="button"
            >
              Add Product
            </button>
          )}
        </div>
      </div>

      <ProductFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleReset}
      />
      <div className="products-actions">
        <select
          className="product-filters__select"
          value={sortBy}
          onChange={(event) => {
            setSortBy(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Sort By (Default)</option>
          <option value="name">Name (A-Z/Z-A)</option>
          <option value="price">Price (Low/High)</option>
          <option value="stock">Stock (Low/High)</option>
        </select>
        <select
          className="product-filters__select"
          value={sortOrder}
          onChange={(event) => {
            setSortOrder(event.target.value);
            setPage(1);
          }}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      {loading && <ProductTableSkeleton />}
      {error && (
        <ErrorState
          message={error}
          onRetry={loadProducts}
        />
      )}
      {!loading && !error && data.length === 0 && (
        <div>No data available</div>
      )}
      {!loading && !error && data.length > 0 && (
        <DataTable
          columns={COLUMNS}
          data={data}
          renderRow={(product) => (
            <ProductRow
              key={product.id}
              product={product}
              canEdit={isAdmin}
              onEdit={() => handleEditClick(product)}
              onDelete={() => handleDeleteClick(product)}
            />
          )}
        />
      )}
      {!loading && !error && (
        <div className="table-pagination">
          <button
            className="btn btn--ghost"
            type="button"
            disabled={meta.page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <span className="table-pagination__info">
            Page {meta.page} of {totalPages}
          </span>
          <button
            className="btn btn--ghost"
            type="button"
            disabled={meta.page >= totalPages}
            onClick={() =>
              setPage((prev) => Math.min(totalPages, prev + 1))
            }
          >
            Next
          </button>
        </div>
      )}
      <ProductFormModal
        open={isAddOpen}
        onSave={handleAddSave}
        onCancel={() => setIsAddOpen(false)}
        initialData={null}
      />
      <ProductFormModal
        open={isEditOpen}
        onSave={handleEditSave}
        onCancel={() => {
          setIsEditOpen(false);
          setEditingProduct(null);
        }}
        initialData={editingProduct}
      />
      <ConfirmDeleteModal
        open={isDeleteOpen}
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.name}?`
            : "Are you sure you want to delete this product?"
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setIsDeleteOpen(false);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

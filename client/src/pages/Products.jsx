import { useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import { useProducts } from "../hooks/useProducts.js";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "../api/products.service.js";
import ProductFilters from "../components/Filters/ProductFilters.jsx";
import LoadingState from "../components/common/LoadingState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import DataTable from "../components/Tables/DataTable.jsx";
import ProductRow from "../components/Tables/ProductRow.jsx";
import ProductFormModal from "../components/Modals/ProductFormModal.jsx";
import ConfirmDeleteModal from "../components/Modals/ConfirmDeleteModal.jsx";
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
  const isAdmin = currentRole === "admin";
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { data, meta, loading, error } = useProducts({
    ...filters,
    page,
    limit,
    sortBy,
    sortOrder,
    refreshKey,
  });
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
    await createProduct(payload);
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
    await updateProduct(editingProduct.id, payload);
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
    await deleteProduct(deleteTarget.id);
    setIsDeleteOpen(false);
    setDeleteTarget(null);
    setPage(1);
    setRefreshKey((prev) => prev + 1);
    window.alert("Product deleted successfully.");
  };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  return (
    <div className="products-page">
      <div className="products-header">
        <h1>Products</h1>
        <div className="products-actions">
          <button className="btn btn--ghost">Export</button>
          <button className="btn btn--ghost">Import</button>
          <button className="btn btn--ghost" disabled={!isAdmin}>
            Bulk Action
          </button>
          <button className="btn btn--danger" disabled={!isAdmin}>
            Delete
          </button>
          <button
            className="btn btn--primary"
            disabled={!isAdmin}
            onClick={handleOpenAdd}
            type="button"
          >
            Add Product
          </button>
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

      {loading && <LoadingState message="Loading products..." />}
      {error && <ErrorState message={error} />}
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

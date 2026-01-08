import { useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import { useOrders } from "../hooks/useOrders.js";
import { updateOrderStatus } from "../api/orders.service.js";
import OrderFilters from "../components/Filters/OrderFilters.jsx";
import LoadingState from "../components/common/LoadingState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import DataTable from "../components/Tables/DataTable.jsx";
import OrderRow from "../components/Tables/OrderRow.jsx";
import UpdateOrderStatusModal from "../components/Modals/UpdateOrderStatusModal.jsx";
import "./Orders.css";

const COLUMNS = [
  {
    key: "select",
    label: <input type="checkbox" />,
    align: "left",
  },
  { key: "invoice", label: "Invoice" },
  { key: "orderTime", label: "Order Time" },
  { key: "customer", label: "Customer" },
  { key: "method", label: "Method" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Action" },
];

const initialFilters = {
  search: "",
  status: "",
  orderLimit: "",
  method: "",
  startDate: "",
  endDate: "",
};

export default function Orders() {
  // Page-level container for order listing and status updates.
  const { user, role } = useAuth();
  const currentRole = role || user?.role;
  const isAdmin = currentRole === "admin";
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingOrder, setEditingOrder] = useState(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const { data, meta, loading, error } = useOrders({
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
  const handleChangeStatus = (order) => {
    if (!isAdmin) {
      return;
    }
    setEditingOrder(order);
    setIsStatusOpen(true);
  };
  const handleStatusSave = async (status) => {
    if (!editingOrder) {
      return;
    }
    await updateOrderStatus(editingOrder.id, status);
    setIsStatusOpen(false);
    setEditingOrder(null);
    setPage(1);
    setRefreshKey((prev) => prev + 1);
    window.alert("Order status updated successfully.");
  };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  return (
    <div className="orders-page">
      <div className="orders-header">
        <h1>Orders</h1>
        <div className="orders-actions">
          <button className="btn btn--ghost">Export</button>
          <button className="btn btn--ghost">Import</button>
          <button className="btn btn--ghost" disabled={!isAdmin}>
            Bulk Action
          </button>
          <button className="btn btn--primary" disabled={!isAdmin}>
            Add Order
          </button>
        </div>
      </div>

      <OrderFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleReset}
      />
      <div className="orders-actions">
        <select
          className="order-filters__select"
          value={sortBy}
          onChange={(event) => {
            setSortBy(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Sort By (Default)</option>
          <option value="orderTime">Date (Newest/Oldest)</option>
          <option value="amount">Amount (Low/High)</option>
          <option value="status">Status (A-Z)</option>
        </select>
        <select
          className="order-filters__select"
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

      {loading && <LoadingState message="Loading orders..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && data.length === 0 && (
        <div>No data available</div>
      )}
      {!loading && !error && data.length > 0 && (
        <DataTable
          columns={COLUMNS}
          data={data}
          renderRow={(order) => (
            <OrderRow
              key={order.id}
              order={order}
              variant="full"
              onEdit={() => handleChangeStatus(order)}
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
      <UpdateOrderStatusModal
        open={isStatusOpen}
        order={editingOrder}
        onSave={handleStatusSave}
        onCancel={() => {
          setIsStatusOpen(false);
          setEditingOrder(null);
        }}
      />
    </div>
  );
}

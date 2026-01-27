import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { orderService } from "../api/index.ts";
import OrderFilters from "../components/Filters/OrderFilters.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import DataTable from "../components/Tables/DataTable.jsx";
import OrderRow from "../components/Tables/OrderRow.jsx";
import UpdateOrderStatusModal from "../components/Modals/UpdateOrderStatusModal.jsx";
import OrderTableSkeleton from "../components/Orders/OrderTableSkeleton.jsx";
import "./Orders.css";

const COLUMNS = [
  {
    key: "select",
    label: <input type="checkbox" />,
    align: "left",
  },
  { key: "invoice", label: "Invoice" },
  { key: "orderTime", label: "Created At" },
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
  const isAdmin = currentRole === "admin" || currentRole === "super_admin";
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingOrder, setEditingOrder] = useState(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const navigate = useNavigate();

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [filters.search]);

  useEffect(() => {
    setPage(1);
  }, [filters.status, filters.method, filters.orderLimit, filters.startDate, filters.endDate]);

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      q: debouncedSearch,
      status: filters.status,
      sort: sortBy,
      order: sortOrder,
      method: filters.method,
      orderLimit: filters.orderLimit,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    [
      page,
      pageSize,
      debouncedSearch,
      filters.status,
      sortBy,
      sortOrder,
      filters.method,
      filters.orderLimit,
      filters.startDate,
      filters.endDate,
    ]
  );

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await orderService.listOrders(queryParams);
      setData(result.data || []);
      if (result.meta) {
        setMeta({
          page: result.meta.page ?? 1,
          pageSize: result.meta.pageSize ?? result.meta.limit ?? pageSize,
          total: result.meta.total ?? 0,
        });
      } else {
        setMeta({ page: 1, pageSize, total: 0 });
      }
    } catch (err) {
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [queryParams, refreshKey]);
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
    if (!isAdmin) {
      return;
    }
    await orderService.updateOrderStatus(editingOrder.id, { status });
    setIsStatusOpen(false);
    setEditingOrder(null);
    setPage(1);
    setRefreshKey((prev) => prev + 1);
    window.alert("Order status updated successfully.");
  };
  const handleViewOrder = (order) => {
    navigate(`/admin/orders/${order.id}`);
  };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="orders-page">
      <div className="orders-header">
        <h1>Orders</h1>
        <div className="orders-actions">
          <button className="btn btn--ghost">Export</button>
          <button className="btn btn--ghost">Import</button>
          {isAdmin && <button className="btn btn--ghost">Bulk Action</button>}
          {isAdmin && <button className="btn btn--primary">Add Order</button>}
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

      {loading && <OrderTableSkeleton />}
      {error && (
        <ErrorState
          message={error}
          onRetry={loadOrders}
        />
      )}
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
              canEdit={isAdmin}
              onEdit={() => handleChangeStatus(order)}
              onView={() => handleViewOrder(order)}
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

import { Eye, Printer } from "lucide-react";
import StatusBadge from "../UI/StatusBadge.jsx";
import { ORDER_STATUS_OPTIONS, toUIStatus } from "../../constants/orderStatus.js";

const getStatusBadgeClass = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "pending":
      return "status-badge status-badge--pending";
    case "processing":
      return "status-badge status-badge--processing";
    case "shipped":
      return "status-badge status-badge--shipped";
    case "completed":
      return "status-badge status-badge--completed";
    case "cancelled":
      return "status-badge status-badge--cancelled";
    default:
      return "status-badge";
  }
};

const STATUS_OPTIONS = ORDER_STATUS_OPTIONS;


const formatInvoice = (order) => {
  if (order?.invoiceNo) {
    return order.invoiceNo;
  }
  if (order?.invoice) {
    return order.invoice;
  }
  const numeric = String(order?.id || "")
    .replace(/\D/g, "")
    .slice(-6)
    .padStart(6, "0");
  return numeric ? `#${numeric}` : `#${order?.id || "-"}`;
};

export default function RecentOrderRow({
  order,
  isAdmin,
  onStatusChange,
  onInvoiceAction,
}) {
  const statusValue = toUIStatus(order?.status || "pending");
  const amount =
    order?.totalAmount ?? order?.amount ?? order?.total ?? 0;
  const displayAmount = order?.__displayAmount || String(amount || 0);
  const displayOrderTime = order?.__displayOrderTime || String(order?.createdAt || order?.orderTime || "-");
  const method = order?.method || order?.paymentMethod || "COD";
  const customerName =
    order?.customerName || order?.customer?.name || order?.customer || "Guest";

  return (
    <tr>
      <td>{formatInvoice(order)}</td>
      <td>{displayOrderTime}</td>
      <td>{customerName}</td>
      <td>{method}</td>
      <td className="dashboard-recent__amount">
        {displayAmount}
      </td>
      <td>
        <span className={getStatusBadgeClass(statusValue)}>{statusValue}</span>
      </td>
      <td>
        <select
          className="dashboard-recent__select"
          value={statusValue}
          onChange={(event) =>
            onStatusChange?.(order, event.target.value)
          }
          disabled={!isAdmin}
          title={
            isAdmin ? "Update status" : "Only admin can update status"
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td>
        <div className="dashboard-recent__invoice-actions">
          <button
            type="button"
            className="dashboard-recent__icon-btn"
            onClick={() => onInvoiceAction?.("print", order)}
            aria-label="Print invoice"
          >
            <Printer size={16} />
          </button>
          <button
            type="button"
            className="dashboard-recent__icon-btn"
            onClick={() => onInvoiceAction?.("view", order)}
            aria-label="View invoice"
          >
            <Eye size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

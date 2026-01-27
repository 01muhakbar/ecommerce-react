import dayjs from "dayjs";
import { Eye, Printer } from "lucide-react";
import StatusBadge from "../UI/StatusBadge.jsx";
import { formatCurrency } from "../../utils/format.js";

const STATUS_OPTIONS = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
];


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

const formatDate = (value) => {
  if (!value) {
    return "-";
  }
  return dayjs(value).isValid()
    ? dayjs(value).format("D MMM, YYYY h:mm A")
    : String(value);
};

export default function RecentOrderRow({
  order,
  isAdmin,
  onStatusChange,
  onInvoiceAction,
}) {
  const statusValue = order?.status || "pending";
  const amount =
    order?.totalAmount ?? order?.amount ?? order?.total ?? 0;
  const method = order?.method || order?.paymentMethod || "COD";
  const customerName =
    order?.customerName || order?.customer?.name || order?.customer || "Guest";

  return (
    <tr>
      <td>{formatInvoice(order)}</td>
      <td>{formatDate(order?.createdAt || order?.orderTime)}</td>
      <td>{customerName}</td>
      <td>{method}</td>
      <td className="dashboard-recent__amount">
        {formatCurrency(amount)}
      </td>
      <td>
        <StatusBadge status={statusValue} />
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

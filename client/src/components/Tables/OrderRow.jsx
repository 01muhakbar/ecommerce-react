import StatusBadge from "../UI/StatusBadge.jsx";
import ActionButtons from "../UI/ActionButtons.jsx";
import { formatCurrency } from "../../utils/format.js";
import "./OrderTable.css";

export default function OrderRow({
  order,
  variant = "compact",
  onEdit,
  onView,
  canEdit,
}) {
  const invoice = order.invoice || order.id;
  const orderTimeRaw = order.createdAt || order.orderTime || order.date;
  const orderTime =
    orderTimeRaw
      ? new Date(orderTimeRaw).toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
  const customerName =
    order.customer?.name || order.customerName || order.customer || "";
  const customerEmail = order.customer?.email || order.customerEmail || "";
  const customerText = customerEmail
    ? `${customerName} • ${customerEmail}`
    : customerName;
  const amountValue = typeof order.amount === "number" ? order.amount : null;
  const amountText =
    amountValue !== null ? formatCurrency(amountValue) : order.total;

  if (variant === "full") {
    return (
      <tr className="order-row">
        <td className="data-table__checkbox">
          <input type="checkbox" />
        </td>
        <td>
          {onView ? (
            <button type="button" className="order-row__link" onClick={onView}>
              {invoice}
            </button>
          ) : (
            invoice
          )}
        </td>
        <td>{orderTime}</td>
        <td>{customerText || "—"}</td>
        <td>{order.method || order.paymentMethod || "COD"}</td>
        <td style={{ textAlign: "right" }}>{amountText}</td>
        <td>
          <StatusBadge status={order.status} />
        </td>
        <td>
          <div style={{ display: "flex", gap: 6 }}>
            {canEdit ? <ActionButtons onEdit={onEdit} /> : null}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="order-row">
      <td>{invoice}</td>
      <td>{order.customer}</td>
      <td>{orderTime}</td>
      <td>{amountText}</td>
      <td>
        <StatusBadge status={order.status} />
      </td>
    </tr>
  );
}

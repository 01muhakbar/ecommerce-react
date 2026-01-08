import StatusBadge from "../UI/StatusBadge.jsx";
import ActionButtons from "../UI/ActionButtons.jsx";
import { formatCurrency } from "../../utils/format.js";
import "./OrderTable.css";

export default function OrderRow({ order, variant = "compact", onEdit }) {
  const invoice = order.invoice || order.id;
  const orderTime = order.orderTime || order.date;
  const amountValue = typeof order.amount === "number" ? order.amount : null;
  const amountText =
    amountValue !== null ? formatCurrency(amountValue) : order.total;

  if (variant === "full") {
    return (
      <tr className="order-row">
        <td className="data-table__checkbox">
          <input type="checkbox" />
        </td>
        <td>{invoice}</td>
        <td>{orderTime}</td>
        <td>{order.customer}</td>
        <td>{order.method}</td>
        <td style={{ textAlign: "right" }}>{amountText}</td>
        <td>
          <StatusBadge status={order.status} />
        </td>
        <td>
          <ActionButtons onEdit={onEdit} />
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

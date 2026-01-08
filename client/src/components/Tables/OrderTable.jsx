import OrderRow from "./OrderRow.jsx";
import "./OrderTable.css";

export default function OrderTable({ orders }) {
  return (
    <div className="table-card">
      <div className="table-card__header">
        <h3>Recent Orders</h3>
      </div>
      <table className="order-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

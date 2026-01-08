import RecentOrderRow from "./RecentOrderRow.jsx";

export default function RecentOrdersTable({
  orders,
  isAdmin,
  onStatusChange,
  onInvoiceAction,
}) {
  return (
    <div className="dashboard-recent">
      <div className="dashboard-recent__header">
        <h3>Recent Orders</h3>
        <span className="dashboard-recent__hint">
          Last 10 orders
        </span>
      </div>
      <div className="dashboard-recent__table-wrap">
        <table className="dashboard-recent__table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Order Time</th>
              <th>Customer Name</th>
              <th>Method</th>
              <th className="dashboard-recent__amount">Amount</th>
              <th>Status</th>
              <th>Action</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <RecentOrderRow
                key={order.id}
                order={order}
                isAdmin={isAdmin}
                onStatusChange={onStatusChange}
                onInvoiceAction={onInvoiceAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

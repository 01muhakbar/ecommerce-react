import React from "react";

// --- TYPE DEFINITIONS ---

interface Order {
  invoiceNo: number;
  orderTime: string;
  customerName?: string; // Made optional for flexibility
  User?: {
    name: string;
  };
  status: "pending" | "processing" | "shipped" | "completed" | "cancelled";
  amount: number;
}

interface OrdersTableProps {
  title: string;
  orders: Order[];
}

// --- HELPER FUNCTIONS ---

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusClass = (
  status: "pending" | "processing" | "shipped" | "completed" | "cancelled"
) => {
  switch (status) {
    case "pending":
      return "bg-yellow-200 text-yellow-800";
    case "processing":
      return "bg-blue-200 text-blue-800";
    case "shipped":
      return "bg-indigo-200 text-indigo-800";
    case "completed":
      return "bg-green-200 text-green-800";
    case "cancelled":
      return "bg-red-200 text-red-800";
    default:
      return "bg-gray-200 text-gray-800";
  }
};

// --- COMPONENT ---

const OrdersTable: React.FC<OrdersTableProps> = ({ title, orders }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3">
                Invoice
              </th>
              <th scope="col" className="px-6 py-3">
                Customer
              </th>
              <th scope="col" className="px-6 py-3">
                Date
              </th>
              <th scope="col" className="px-6 py-3">
                Amount
              </th>
              <th scope="col" className="px-6 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.invoiceNo}
                className="bg-white border-b hover:bg-gray-50"
              >
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                  #{order.invoiceNo}
                </td>
                <td className="px-6 py-4">
                  {order.customerName || order.User?.name || "N/A"}
                </td>
                <td className="px-6 py-4">{formatDate(order.orderTime)}</td>
                <td className="px-6 py-4">{formatCurrency(order.amount)}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(
                      order.status
                    )}`}
                  >
                    {order.status.charAt(0).toUpperCase() +
                      order.status.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrdersTable;

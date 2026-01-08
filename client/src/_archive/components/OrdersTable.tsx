import React from "react";
import type { Order } from "../types/order"; // Import the centralized type

// --- TYPE DEFINITIONS ---
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

const getStatusClass = (status: Order["status"]) => {
  switch (
    status // Status is now capitalized
  ) {
    case "Pending":
      return "bg-yellow-200 text-yellow-800";
    case "Processing":
      return "bg-blue-200 text-blue-800";
    case "Delivered":
      return "bg-green-200 text-green-800";
    case "Cancelled":
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
              <tr key={order.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                  #{order.invoiceNo}
                </td>
                <td className="px-6 py-4">{order.customerName}</td>
                <td className="px-6 py-4">{formatDate(order.orderTime)}</td>
                <td className="px-6 py-4">{formatCurrency(order.amount)}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(
                      order.status
                    )}`}
                  >
                    {order.status}
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

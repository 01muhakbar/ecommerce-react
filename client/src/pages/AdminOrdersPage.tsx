import React, { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import api from "../api/axios";
import type { Order } from "../types/order";
import OrdersTable from "../components/OrdersTable";
import Pagination from "../components/Pagination";

// Define types for the API response
interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface ApiResponse {
  data: Order[];
  pagination: PaginationData;
}

const AdminOrdersPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 8;

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["adminOrders", currentPage, limit],
    queryFn: async () => {
      const { data } = await api.get(
        `/admin/orders?page=${currentPage}&limit=${limit}`
      );
      return data;
    },
    placeholderData: keepPreviousData, // To keep showing old data while new data is fetching
  });

  if (error) {
    return (
      <div className="text-red-500">Error fetching orders: {error.message}</div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Order Management</h1>

      {/* The OrdersTable component includes its own card styling and title.
          We pass it an empty array if data is not yet available.
          The `isLoading` state is used to show a separate loading indicator. */}
      <OrdersTable title="All Orders" orders={data?.data || []} />

      {isLoading && <div className="text-center p-4">Fetching orders...</div>}

      {data && data.pagination.totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            currentPage={data.pagination.currentPage}
            totalPages={data.pagination.totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;

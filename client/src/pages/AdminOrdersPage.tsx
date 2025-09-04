import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import OrdersTable from '../components/OrdersTable';
import Pagination from '../components/Pagination';

// Define types for the API response
interface Order {
  id: number;
  invoiceNo: number;
  orderTime: string;
  customerName: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
}

interface ApiResponse {
  data: Order[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

const AdminOrdersPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 8;

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['adminOrders', currentPage, limit],
    queryFn: async () => {
      const { data } = await api.get(`/admin/orders?page=${currentPage}&limit=${limit}`);
      return data;
    },
    keepPreviousData: true, // To keep showing old data while new data is fetching
  });

  if (error) {
    return <div className="text-red-500">Error fetching orders: {error.message}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Order Management</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
        <OrdersTable orders={data?.data || []} isLoading={isLoading} />
        {data && data.pagination.totalPages > 1 && (
          <Pagination
            currentPage={data.pagination.currentPage}
            totalPages={data.pagination.totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
};

export default AdminOrdersPage;

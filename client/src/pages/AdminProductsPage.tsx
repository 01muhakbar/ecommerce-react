import React, { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Pagination from "../components/Pagination";
import ProductsTable from "../components/ProductsTable";

// Define types for the API response
interface Product {
  id: number;
  name: string;
  category?: { name: string };
  price: number;
  stock: number;
  isPublished: boolean;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface ApiResponse {
  data: Product[];
  pagination: PaginationData;
}

const AdminProductsPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const limit = 10;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset ke halaman pertama saat pencarian baru
    }, 500); // Delay 500ms

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const { data, isLoading, error, isFetching } = useQuery<ApiResponse>({
    queryKey: ["adminProducts", currentPage, limit, debouncedSearchTerm],
    queryFn: async () => {
      const params: { page: number; limit: number; search?: string } = {
        page: currentPage,
        limit,
      };
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }
      const { data } = await api.get("/admin/products", { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

  if (error) {
    // Penanganan error yang lebih baik
    const status = (error as any)?.response?.status;
    const message = (error as any)?.response?.data?.message || error.message;
    let friendlyMessage = `Error fetching products: ${message}`;

    if (status === 401) {
      friendlyMessage = "Sesi Anda telah berakhir. Silakan login kembali.";
    } else if (status === 403) {
      friendlyMessage =
        "Akses ditolak. Anda tidak memiliki izin untuk melihat sumber daya ini.";
    }

    return <div className="p-6 text-red-500">{friendlyMessage}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Product Management</h1>
        <Link
          to="/admin/catalog/products/new"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
        >
          Tambah Produk Baru
        </Link>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700"
            >
              Cari Produk
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          {/* Add more filters here if needed, e.g., by category */}
        </div>
      </div>

      {/* Loading and Fetching Indicators */}
      {isLoading ? (
        <div className="text-center p-8">
          <p className="text-lg font-semibold">Memuat produk...</p>
        </div>
      ) : isFetching ? (
        <div className="text-center py-2 text-sm text-gray-500">
          <p>Memperbarui daftar...</p>
        </div>
      ) : null}

      {/* Products Table */}
      {!isLoading && data?.data && <ProductsTable products={data.data} />}

      {/* No Products Message */}
      {!isLoading && (!data || data.data.length === 0) && (
        <div className="text-center bg-white p-8 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-700">
            Produk Tidak Ditemukan
          </h2>
          <p className="text-gray-500 mt-2">
            Coba sesuaikan pencarian atau filter Anda, atau tambahkan produk
            baru.
          </p>
        </div>
      )}

      {/* Pagination */}
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

export default AdminProductsPage;

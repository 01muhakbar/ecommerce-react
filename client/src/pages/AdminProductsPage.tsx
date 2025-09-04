import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import StatusBadge from "../components/StatusBadge";
import ToggleSwitch from "../components/ToggleSwitch";
import Pagination from "../components/Pagination";
import { debounce } from "lodash";

// --- Type Definitions ---
interface Product {
  id: number;
  name: string;
  category?: { name: string };
  stock: number;
  price: number;
  status: string;
  isPublished: boolean;
}

interface ApiResponse {
  data: Product[];
  pagination: {
    totalPages: number;
    currentPage: number;
  };
}

// --- API Fetcher ---
const fetchProducts = async (filters: {
  page: number;
  search: string;
}): Promise<ApiResponse> => {
  const { data } = await api.get("/admin/products", {
    params: { ...filters, limit: 10 },
  });
  return data;
};

// --- Main Component ---
const AdminProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<ApiResponse, Error>({
    queryKey: ["adminProducts", { page, search }],
    queryFn: () => fetchProducts({ page, search }),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/products/${id}`),
    onSuccess: () => {
      // toast.success("Product deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
    },
    onError: () => {
      // toast.error("Failed to delete product.");
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: (id: number) =>
      api.patch(`/admin/products/${id}/toggle-publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
    },
    onError: () => {
      // toast.error("Failed to update publish status.");
    },
  });

  const debouncedSearch = debounce((value: string) => {
    setPage(1);
    setSearch(value);
  }, 500);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Products</h1>
        <div className="flex items-center space-x-2">
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">
            Export
          </button>
          <button
            onClick={() => navigate("/admin/catalog/products/new")}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors text-sm font-semibold"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            name="search"
            placeholder="Search products..."
            onChange={handleSearchChange}
            className="p-2 border rounded-lg w-full"
          />
          <select name="category" className="p-2 border rounded-lg bg-white">
            <option value="">All Categories</option>
          </select>
          <select name="price" className="p-2 border rounded-lg bg-white">
            <option value="">Any Price</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3">
                Product
              </th>
              <th scope="col" className="px-6 py-3">
                Category
              </th>
              <th scope="col" className="px-6 py-3">
                Stock
              </th>
              <th scope="col" className="px-6 py-3">
                Price
              </th>
              <th scope="col" className="px-6 py-3">
                Status
              </th>
              <th scope="col" className="px-6 py-3">
                Published
              </th>
              <th scope="col" className="px-6 py-3 text-center">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center p-4">
                  Loading...
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={7} className="text-center p-4 text-red-500">
                  Error loading data
                </td>
              </tr>
            )}
            {data?.data.map((product) => (
              <tr
                key={product.id}
                className="bg-white border-b hover:bg-gray-50"
              >
                <td className="px-6 py-4 font-medium text-gray-900">
                  {product.name}
                </td>
                <td className="px-6 py-4">{product.category?.name || "N/A"}</td>
                <td className="px-6 py-4">{product.stock}</td>
                <td className="px-6 py-4">{formatCurrency(product.price)}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={product.status} />
                </td>
                <td className="px-6 py-4">
                  <ToggleSwitch
                    checked={product.isPublished}
                    onChange={() => togglePublishMutation.mutate(product.id)}
                    disabled={togglePublishMutation.isPending}
                  />
                </td>
                <td className="px-6 py-4 text-center space-x-2">
                  <button
                    onClick={() =>
                      navigate(`/admin/catalog/products/edit/${product.id}`)
                    }
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="font-medium text-red-600 hover:underline"
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={data.pagination.currentPage}
            totalPages={data.pagination.totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;

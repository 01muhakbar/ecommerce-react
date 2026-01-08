import React from "react";

// Define a basic Product type for this component's props
interface Product {
  id: number;
  name: string;
  category?: { name: string };
  price: number;
  stock: number;
  isPublished: boolean;
}

interface ProductsTableProps {
  products: Product[];
  // Add any event handlers you need, e.g., onEdit, onDelete
}

const ProductsTable: React.FC<ProductsTableProps> = ({ products }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
      <table className="w-full text-sm text-left text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3">
              Product Name
            </th>
            <th scope="col" className="px-6 py-3">
              Category
            </th>
            <th scope="col" className="px-6 py-3">
              Price
            </th>
            <th scope="col" className="px-6 py-3">
              Stock
            </th>
            <th scope="col" className="px-6 py-3 text-center">
              Status
            </th>
            <th scope="col" className="px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="bg-white border-b hover:bg-gray-50">
              <th
                scope="row"
                className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"
              >
                {product.name}
              </th>
              <td className="px-6 py-4">{product.category?.name || "N/A"}</td>
              <td className="px-6 py-4">{formatCurrency(product.price)}</td>
              <td className="px-6 py-4">{product.stock}</td>
              <td className="px-6 py-4 text-center">
                {product.isPublished ? (
                  <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                    Published
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full">
                    Unpublished
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <a
                  href="#"
                  className="font-medium text-blue-600 hover:underline"
                >
                  Edit
                </a>
                <a
                  href="#"
                  className="ml-4 font-medium text-red-600 hover:underline"
                >
                  Delete
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductsTable;

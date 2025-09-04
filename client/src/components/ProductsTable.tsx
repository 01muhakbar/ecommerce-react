import React from "react";

interface Product {
  id: number;
  name: string;
  Category?: { name: string };
  stock: number;
  price: number;
  isPublished: boolean;
}

interface ProductsTableProps {
  products: Product[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onTogglePublish: (id: number) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  onEdit,
  onDelete,
  onTogglePublish,
}) => {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full text-sm text-left text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3">
              Product
            </th>
            <th scope_col="col" className="px-6 py-3">
              Category
            </th>
            <th scope_col="col" className="px-6 py-3">
              Stock
            </th>
            <th scope_col="col" className="px-6 py-3">
              Price
            </th>
            <th scope_col="col" className="px-6 py-3">
              Published
            </th>
            <th scope_col="col" className="px-6 py-3 text-center">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="bg-white border-b hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">
                {product.name}
              </td>
              <td className="px-6 py-4">{product.Category?.name || "N/A"}</td>
              <td className="px-6 py-4">{product.stock}</td>
              <td className="px-6 py-4">{formatCurrency(product.price)}</td>
              <td className="px-6 py-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={product.isPublished}
                    onChange={() => onTogglePublish(product.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-teal-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </td>
              <td className="px-6 py-4 text-center space-x-2">
                <button
                  onClick={() => onEdit(product.id)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(product.id)}
                  className="font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductsTable;

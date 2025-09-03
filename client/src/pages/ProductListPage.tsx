import React from 'react';
import api from '../api/axios';
import { useQuery } from '@tanstack/react-query';

interface Product {
  id: number;
  name: string;
  price: number;
  // Tambahkan properti lain jika diperlukan di masa mendatang
}

// Fungsi untuk mengambil data produk, akan digunakan oleh useQuery
const fetchProducts = async (): Promise<Product[]> => {
  // Sesuaikan URL endpoint jika backend Anda berjalan di port atau domain yang berbeda
  const response = await api.get('/products');
  // Asumsi struktur respons API adalah { data: { products: [...] } }
  return response.data.data.products;
};

const ProductListPage: React.FC = () => {
  // Gunakan useQuery untuk fetching data
  const { 
    data: products, 
    isLoading, 
    isError, 
    error 
  } = useQuery<Product[], Error>({
    queryKey: ['products'], // Kunci unik untuk query ini
    queryFn: fetchProducts,    // Fungsi yang akan dijalankan untuk mengambil data
  });

  // useQuery secara otomatis menyediakan state isLoading
  if (isLoading) {
    return <div className="text-center py-16 text-xl font-semibold">Memuat produk...</div>;
  }

  // useQuery juga menangani error secara otomatis
  if (isError) {
    return <div className="text-center py-16 text-red-500 text-xl font-semibold">Error: {error.message}</div>;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Semua Produk</h1>

      {products && products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300"
            >
              <div className="p-6">
                <h4 className="text-xl font-semibold text-gray-800 mb-2 truncate">
                  {product.name}
                </h4>
                <p className="text-gray-600 mb-4">
                  Rp
                  {new Intl.NumberFormat('id-ID').format(product.price)}
                </p>

                {/* Ini adalah placeholder untuk tombol "Tambah ke Keranjang" */}
                <button
                  type="button"
                  className="w-full bg-blue-500 text-white hover:bg-blue-600 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                  onClick={() => alert(`Menambahkan ${product.name} ke keranjang`)}
                >
                  Tambah ke Keranjang
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Belum Ada Produk</h2>
          <p className="text-gray-500">Silakan cek kembali nanti.</p>
        </div>
      )}
    </div>
  );
};

export default ProductListPage;

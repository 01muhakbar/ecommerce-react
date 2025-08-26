const AddProductForm = ({ categories }) => {
  const [productData, setProductData] = React.useState({
    name: "",
    description: "",
    categoryId: categories.length > 0 ? categories[0].id : "",
    price: "",
    stock: 0,
    status: "published",
  });
  const [loading, setLoading] = React.useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProductData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (status) => {
    if (!productData.name || !productData.price) {
      alert("Nama produk dan harga tidak boleh kosong.");
      return;
    }

    setLoading(true);
    try {
      const dataToSend = { ...productData, status };
      await axios.post("/api/v1/products", dataToSend);
      alert("Produk berhasil disimpan!");
      window.location.href = "/dashboard/products";
    } catch (error) {
      console.error("Error submitting product:", error);
      alert("Gagal menyimpan produk. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (window.confirm("Buang perubahan?")) {
      window.location.href = "/dashboard/products";
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        1. Informasi Produk
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="product-name"
            className="block text-sm font-medium text-gray-700"
          >
            Nama Produk <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="product-name"
            name="name"
            value={productData.name}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Deskripsi <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={productData.description}
            onChange={handleChange}
            rows="4"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          ></textarea>
        </div>
        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700"
          >
            Kategori <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            name="categoryId"
            value={productData.categoryId}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="price"
            className="block text-sm font-medium text-gray-700"
          >
            Harga <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">Rp</span>
            </div>
            <input
              type="number"
              id="price"
              name="price"
              value={productData.price}
              onChange={handleChange}
              className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Mohon masukkan"
              required
              min="0"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="stock"
            className="block text-sm font-medium text-gray-700"
          >
            Stok <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="stock"
            name="stock"
            value={productData.stock}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
            min="0"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-4 mt-6">
        <button
          type="button"
          onClick={handleBack}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("archived")}
          disabled={loading}
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
        >
          {loading ? "Menyimpan..." : "Simpan & Arsipkan"}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("published")}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          {loading ? "Menerbitkan..." : "Simpan & Tampilkan"}
        </button>
      </div>
    </div>
  );
};

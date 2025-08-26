document.addEventListener("DOMContentLoaded", () => {
  // Pastikan Axios sudah tersedia dari CDN
  if (typeof axios === "undefined") {
    console.error(
      "Axios tidak ditemukan. Pastikan Anda sudah menambahkannya melalui CDN di file EJS."
    );
    return;
  }

  // Ambil elemen tombol dari halaman
  const savePublishBtn = document.getElementById("save-publish-btn");
  const saveArchiveBtn = document.getElementById("save-archive-btn");
  const backBtn = document.getElementById("back-btn");

  // Fungsi utama untuk menangani pengiriman form
  const handleSubmit = async (status) => {
    // 1. Ambil semua data dari form
    const productData = {
      name: document.getElementById("product-name").value,
      price: document.getElementById("product-price").value,
      description: document.getElementById("product-description").value,
      categoryId: document.getElementById("product-category").value,
      stock: document.getElementById("product-stock").value,
      // 2. Tambahkan properti status sesuai parameter
      status: status,
    };

    // 3. Validasi sederhana
    if (!productData.name || !productData.price) {
      alert("Nama produk dan harga tidak boleh kosong.");
      return;
    }

    // Menangani loading state: nonaktifkan tombol selama proses
    savePublishBtn.disabled = true;
    saveArchiveBtn.disabled = true;
    savePublishBtn.textContent = "Menyimpan...";

    try {
      // 4. Kirim data ke API menggunakan Axios
      const response = await axios.post("/api/products", productData, {
        headers: {
          // Jika Anda menggunakan autentikasi token, tambahkan di sini
          // 'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });

      // 5. Jika berhasil, tampilkan notifikasi dan redirect
      if (response.data.success) {
        alert("Produk berhasil disimpan!");
        window.location.href = "/dashboard/products";
      } else {
        // Menangani error dari server yang terstruktur
        alert(`Gagal: ${response.data.message || "Terjadi kesalahan."}`);
      }
    } catch (error) {
      // 6. Jika gagal, tampilkan notifikasi error
      console.error("Error saat menyimpan produk:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Gagal menyimpan produk. Silakan coba lagi.";
      alert(errorMessage);
    } finally {
      // Kembalikan tombol ke keadaan semula setelah proses selesai
      savePublishBtn.disabled = false;
      saveArchiveBtn.disabled = false;
      savePublishBtn.textContent = "Simpan & Tampilkan";
    }
  };

  // Tambahkan event listener untuk tombol "Simpan & Tampilkan"
  if (savePublishBtn) {
    savePublishBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Mencegah form submit default
      handleSubmit("published");
    });
  }

  // Tambahkan event listener untuk tombol "Simpan & Arsipkan"
  if (saveArchiveBtn) {
    saveArchiveBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Mencegah form submit default
      handleSubmit("archived");
    });
  }

  // Logika untuk tombol "Kembali"
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      const userConfirmed = confirm("Buang perubahan?");
      if (userConfirmed) {
        window.location.href = "/dashboard/products";
      }
    });
  }
});

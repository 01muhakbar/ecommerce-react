/**
 * Modul ini menangani otentikasi dasar di sisi klien.
 */

// Fungsi untuk memeriksa apakah pengguna sudah login.
// Jika tidak, akan diarahkan ke halaman login.
function requireAuth() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    // Ganti window.location untuk mencegah pengguna menekan tombol "kembali"
    // dan melihat konten yang dilindungi setelah token dihapus.
    window.location.replace("/login");
  }
  return token;
}


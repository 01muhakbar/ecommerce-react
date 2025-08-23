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

/**
 * Fungsi untuk memeriksa apakah pengguna sudah login DAN memiliki peran tertentu.
 * Jika tidak, akan diarahkan ke halaman login.
 * @param {string[]} allowedRoles - Array peran yang diizinkan, misal: ['penjual', 'admin']
 */
function requireRole(allowedRoles) {
  // Pertama, pastikan pengguna sudah login
  requireAuth();

  // Ambil data pengguna dari localStorage
  const userString = localStorage.getItem("user");
  if (!userString) {
    console.error("Data pengguna tidak ditemukan di localStorage.");
    window.location.replace("/login");
    return;
  }

  const user = JSON.parse(userString);
  if (!allowedRoles.includes(user.role)) {
    alert("Anda tidak memiliki izin untuk mengakses halaman ini.");
    // Arahkan ke halaman utama jika peran tidak sesuai
    window.location.replace("/");
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-password-form');
  const passwordInput = document.getElementById('password');
  const passwordConfirmInput = document.getElementById('password-confirm');
  const messageDiv = document.getElementById('message');

  const togglePassword = document.getElementById('togglePassword');

  // Fungsi untuk menampilkan pesan
  const showMessage = (msg, type) => {
    messageDiv.textContent = msg;
    messageDiv.className = `text-sm font-medium mt-4 p-3 rounded-md ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
    messageDiv.style.display = 'block';
  };

  // Toggle password visibility
  togglePassword.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    // Anda bisa mengganti ikon di sini jika ingin
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    // Dapatkan token dari URL
    const path = window.location.pathname;
    const token = path.split('/').pop(); // Mengambil bagian terakhir dari path

    if (!token) {
      showMessage('Token reset password tidak ditemukan di URL.', 'error');
      return;
    }

    if (password !== passwordConfirm) {
      showMessage('Password dan konfirmasi password tidak cocok.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/v1/auth/reset-password/${token}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, passwordConfirm }),
      });

      const data = await res.json();

      if (data.status === 'success') {
        showMessage('Password berhasil direset! Anda akan diarahkan ke halaman login.', 'success');
        // Opsional: Arahkan ke halaman login setelah beberapa detik
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      } else {
        showMessage(data.message || 'Terjadi kesalahan saat mereset password.', 'error');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      showMessage('Terjadi kesalahan jaringan atau server. Coba lagi nanti.', 'error');
    }
  });
});
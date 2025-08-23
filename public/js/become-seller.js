document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('become-seller-form');
  const storeNameInput = document.getElementById('storeName');
  const descriptionInput = document.getElementById('description');
  const messageDiv = document.getElementById('message');

  // Fungsi untuk menampilkan pesan
  const showMessage = (msg, type) => {
    messageDiv.textContent = msg;
    messageDiv.className = `text-sm font-medium mt-4 p-3 rounded-md ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
    messageDiv.style.display = 'block';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const storeName = storeNameInput.value;
    const description = descriptionInput.value;

    try {
      const response = await fetch('/api/v1/users/become-seller', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeName, description }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        showMessage('Selamat! Anda sekarang adalah penjual. Mengarahkan ke dashboard penjual...', 'success');
        // Perbarui role di localStorage jika disimpan di sana
        let user = JSON.parse(localStorage.getItem('user'));
        if (user) {
          user.role = 'penjual';
          localStorage.setItem('user', JSON.stringify(user));
        }
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 3000);
      } else {
        showMessage(data.message || 'Terjadi kesalahan saat mendaftar sebagai penjual.', 'error');
      }
    } catch (error) {
      console.error('Error becoming seller:', error);
      showMessage('Terjadi kesalahan jaringan atau server. Coba lagi nanti.', 'error');
    }
  });
});

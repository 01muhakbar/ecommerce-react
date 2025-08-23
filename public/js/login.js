document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const errorMessageDiv = document.getElementById("error-message");

  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");

  // Toggle password visibility
  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      // Anda bisa mengganti ikon di sini jika ingin
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      // Mencegah form dari submit default (reload halaman)
      event.preventDefault();

      // Kosongkan pesan error sebelumnya
      errorMessageDiv.textContent = "";
      errorMessageDiv.style.display = "none";

      // Ambil data dari form
      const email = document.getElementById("email-address").value;
      const password = document.getElementById("password").value;

      try {
        const response = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        // Jika response TIDAK sukses (status code bukan 2xx)
        if (!response.ok) {
          // Tampilkan pesan error dari backend
          errorMessageDiv.textContent = data.message || "Terjadi kesalahan.";
          errorMessageDiv.style.display = "block";
          return;
        }

        // Jika login berhasil
        // 1. Simpan token sebagai cookie agar backend bisa membacanya
        // Set cookie to expire in 1 day
        document.cookie = `jwt=${data.data.token}; path=/; max-age=86400`;

        // 2. Simpan data pengguna di localStorage untuk kemudahan akses di frontend
        // localStorage.setItem("user", JSON.stringify(data.data.user));

        // 3. Arahkan ke halaman dashboard berdasarkan role
        

        // Arahkan ke halaman dashboard utama, server akan menangani sisanya
        window.location.href = "/dashboard";
      } catch (error) {
        // Menangani error jaringan atau jika server tidak merespons
        console.error("Login error:", error);
        errorMessageDiv.textContent =
          "Tidak dapat terhubung ke server. Silakan coba lagi nanti.";
        errorMessageDiv.style.display = "block";
      }
    });
  }
});

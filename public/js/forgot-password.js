document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgot-password-form");
  const messageDiv = document.createElement("div"); // Buat div untuk pesan
  messageDiv.className = "text-sm font-medium mt-4 text-center";
  messageDiv.style.display = "none";
  form.after(messageDiv); // Sisipkan setelah form

  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    messageDiv.style.display = "none";
    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";

    const email = form.email.value;

    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      // Selalu tampilkan pesan sukses untuk keamanan
      messageDiv.textContent = result.message;
      messageDiv.className =
        "text-green-600 text-sm font-medium mt-4 text-center";
      messageDiv.style.display = "block";
      form.reset(); // Kosongkan form
    } catch (error) {
      console.error("Forgot Password Error:", error);
      messageDiv.textContent = "Terjadi kesalahan. Silakan coba lagi nanti.";
      messageDiv.className =
        "text-red-600 text-sm font-medium mt-4 text-center";
      messageDiv.style.display = "block";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Kirim Link Reset";
    }
  });
});

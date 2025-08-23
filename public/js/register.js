document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("register-form");
  const messageDiv = document.getElementById("message");

  if (!registerForm) {
    console.error("Register form not found!");
    return;
  }

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    messageDiv.style.display = "none";

    const formData = new FormData(registerForm);
    const data = Object.fromEntries(formData.entries());

    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok) {
      messageDiv.textContent =
        "Registrasi berhasil! Anda akan diarahkan ke halaman login.";
      messageDiv.className = "text-green-600 text-sm font-medium";
      setTimeout(() => (window.location.href = "/login"), 2000);
    } else {
      messageDiv.textContent = result.message || "Registrasi gagal.";
      messageDiv.className = "text-red-600 text-sm font-medium";
    }
    messageDiv.style.display = "block";
  });
});

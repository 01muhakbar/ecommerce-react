// d:/ecommerce-react/server/src/server.ts
import app from "./app"; // Impor konfigurasi Express dari app.ts
import "./models"; // Import models to ensure they are registered

const PORT = process.env.PORT || 3000;

/**
 * Fungsi utama untuk memulai server.
 * Ini akan menginisialisasi database terlebih dahulu,
 * baru kemudian menjalankan server Express.
 */
const startServer = async () => {
  try {
    console.log("Attempting to connect to the database...");
    const sequelize = (await import("./config/database")).default;
    await sequelize.authenticate();
    console.log("Database connected successfully.");

    // --- SINKRONISASI DATABASE ---
    // Pindahkan logika sinkronisasi ke sini.
    // `{ alter: true }` akan mencoba mengubah tabel yang ada agar sesuai dengan model.
    console.log("Synchronizing database models...");
    await sequelize.sync({ alter: true });
    console.log("Database synchronized successfully.");

    app.listen(PORT, () => {
      console.log(
        `🚀 Server is running on http://localhost:${PORT} with DB sync`
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1); // Keluar dari proses jika gagal memulai
  }
};

// Panggil fungsi untuk memulai server
startServer();

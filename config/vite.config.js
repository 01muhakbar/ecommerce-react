import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Tentukan di mana file hasil build akan disimpan
    outDir: 'public/dist',
    // Hapus file lama di outDir sebelum build
    emptyOutDir: true,
    rollupOptions: {
      // Tentukan file JavaScript utama Anda sebagai entry point
      input: {
        main: 'src/main.jsx', // Ganti dengan path ke file React utama Anda
      },
    },
  },
});
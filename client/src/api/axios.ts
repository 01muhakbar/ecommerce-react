import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  withCredentials: true, // Penting untuk mengirim cookie (misal: untuk refresh token)
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    // Ambil state dari authStore
    const { token } = useAuthStore.getState();

    // Jika token ada, tambahkan ke header Authorization
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    // Lakukan sesuatu jika ada error pada request
    return Promise.reject(error);
  }
);

export default api;

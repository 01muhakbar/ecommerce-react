import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { loginAdminSchema } from "@ecommerce/schemas";
import { useAuthStore } from "../store/authStore";
import api from "../api/axios";

// --- Icon Components ---
const MailIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const SpinnerIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="animate-spin"
    {...props}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// --- New Auth Graphic Component ---
const AuthGraphic = () => (
  <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-full opacity-50">
      {/* Abstract shapes */}
      <div className="absolute -top-16 -left-16 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute -bottom-24 -right-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute top-1/2 left-1/2 w-48 h-48 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full mix-blend-screen filter blur-md opacity-50"></div>
    </div>
    <div className="relative z-10 flex flex-col items-center justify-center h-full p-12 text-white">
      <h2 className="text-4xl font-bold mb-4">E-Commerce</h2>
      <p className="text-lg text-blue-100 max-w-sm text-center">
        Manajemen terpusat untuk toko online Anda. Kelola produk, pesanan, dan
        pelanggan dengan mudah.
      </p>
    </div>
  </div>
);

// --- Type Definition ---
type LoginAdminInput = z.infer<typeof loginAdminSchema>;

// --- Main Component ---
const AdminLoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginAdminInput>({
    resolver: zodResolver(loginAdminSchema),
  });

  const mutation = useMutation<any, Error, LoginAdminInput>({
    mutationFn: async (data) => {
      const response = await api.post("/auth/admin/login", data);
      return response.data;
    },
    onSuccess: (data) => {
      login(data.data.user, data.data.token);
      navigate("/admin/dashboard");
    },
    onError: () => {
      setError("root.serverError", {
        type: "manual",
        message: "Email atau password yang Anda masukkan salah.",
      });
    },
  });

  const onSubmit = (data: LoginAdminInput) => {
    mutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl mx-auto min-h-[600px]">
        <div className="grid md:grid-cols-2 bg-white rounded-2xl shadow-2xl shadow-slate-400/20 overflow-hidden h-full">
          {/* Left Column: Graphic */}
          <div className="hidden md:flex items-center justify-center">
            <AuthGraphic />
          </div>

          {/* Right Column: Form */}
          <div className="p-8 sm:p-12 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Admin Login
              </h1>
              <p className="text-gray-500 mb-8">
                Selamat datang kembali! Silakan masuk.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {errors.root?.serverError && (
                  <div
                    className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative"
                    role="alert"
                  >
                    <p>{errors.root.serverError.message}</p>
                  </div>
                )}

                {/* Email Input */}
                <div className="relative group">
                  <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="alamat@email.com"
                    className={`w-full pl-12 pr-4 py-3 bg-gray-100 border rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:bg-white ${
                      errors.email
                        ? "border-red-400 ring-red-300 focus:ring-red-500"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 -mt-4">
                    {String(errors.email.message || "")}
                  </p>
                )}

                {/* Password Input */}
                <div className="relative group">
                  <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder="Password"
                    className={`w-full pl-12 pr-12 py-3 bg-gray-100 border rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:bg-white ${
                      errors.password
                        ? "border-red-400 ring-red-300 focus:ring-red-500"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600 -mt-4">
                    {String(errors.password.message || "")}
                  </p>
                )}

                <div className="text-sm text-right">
                  <Link
                    to="/admin/forgot-password"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Lupa Kata Sandi?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-lg shadow-blue-600/20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:shadow-none disabled:cursor-not-allowed transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  {mutation.isPending ? (
                    <>
                      <SpinnerIcon className="h-5 w-5 mr-3" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    "Login"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;

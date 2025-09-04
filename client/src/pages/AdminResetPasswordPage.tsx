import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { resetPasswordAdminSchema, type ResetPasswordAdminInput } from "@ecommerce/schemas";
import api from "../api/axios";

// --- Icon Components ---
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

// --- Main Component ---
const AdminResetPasswordPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ResetPasswordAdminInput>({
    resolver: zodResolver(resetPasswordAdminSchema),
  });

  const mutation = useMutation<any, Error, ResetPasswordAdminInput>({
    mutationFn: async (data) => {
      if (!token) {
        throw new Error("Token reset tidak ditemukan.");
      }
      const response = await api.post(`/auth/admin/reset-password/${token}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      setError("root.serverSuccess", { type: "manual", message: data.message || "Kata sandi berhasil direset!" });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || "Terjadi kesalahan. Silakan coba lagi.";
      setError("root.serverError", { type: "manual", message });
    },
  });

  const onSubmit = (data: ResetPasswordAdminInput) => {
    mutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-400/20 overflow-hidden p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Reset Kata Sandi Admin</h1>
          <p className="text-gray-500 mb-8">Masukkan kata sandi baru Anda.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {errors.root?.serverError && (
              <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                <p>{errors.root.serverError.message}</p>
              </div>
            )}
            {errors.root?.serverSuccess && (
              <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg relative" role="alert">
                <p>{errors.root.serverSuccess.message}</p>
                <Link to="/admin/login" className="text-blue-600 hover:underline mt-2 block">Kembali ke Halaman Login</Link>
              </div>
            )}

            {/* Password Input */}
            <div className="relative group">
              <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register("password")}
                placeholder="Kata Sandi Baru"
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
                    ? "Sembunyikan kata sandi"
                    : "Tampilkan kata sandi"
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
                {errors.password.message}
              </p>
            )}

            {/* Confirm Password Input */}
            <div className="relative group">
              <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                id="passwordConfirm"
                type={showConfirmPassword ? "text" : "password"}
                {...register("passwordConfirm")}
                placeholder="Konfirmasi Kata Sandi Baru"
                className={`w-full pl-12 pr-12 py-3 bg-gray-100 border rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:bg-white ${
                  errors.passwordConfirm
                    ? "border-red-400 ring-red-300 focus:ring-red-500"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={
                  showConfirmPassword
                    ? "Sembunyikan konfirmasi kata sandi"
                    : "Tampilkan konfirmasi kata sandi"
                }
              >
                {showConfirmPassword ? (
                  <EyeOffIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.passwordConfirm && (
              <p className="text-sm text-red-600 -mt-4">
                {errors.passwordConfirm.message}
              </p>
            )}

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
                "Reset Kata Sandi"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminResetPasswordPage;

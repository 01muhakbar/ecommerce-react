import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { forgotPasswordAdminSchema } from "@ecommerce/schemas";
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

// --- Type Definition ---
type ForgotPasswordAdminInput = z.infer<typeof forgotPasswordAdminSchema>;

// --- Main Component ---
const AdminForgotPasswordPage: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ForgotPasswordAdminInput>({
    resolver: zodResolver(forgotPasswordAdminSchema),
  });

  const mutation = useMutation<any, Error, ForgotPasswordAdminInput>({
    mutationFn: async (data) => {
      const response = await api.post("/auth/admin/forgot-password", data);
      return response.data;
    },
    onSuccess: (data) => {
      // Display success message
      setError("root.serverSuccess", { type: "manual", message: data.message });
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message ||
        "Terjadi kesalahan. Silakan coba lagi.";
      setError("root.serverError", { type: "manual", message });
    },
  });

  const onSubmit = (data: ForgotPasswordAdminInput) => {
    mutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-400/20 overflow-hidden p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Lupa Kata Sandi Admin
          </h1>
          <p className="text-gray-500 mb-8">
            Masukkan alamat email Anda dan kami akan mengirimkan tautan untuk
            mereset kata sandi Anda.
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
            {errors.root?.serverSuccess && (
              <div
                className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg relative"
                role="alert"
              >
                <p>{errors.root.serverSuccess.message}</p>
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
                {String(errors.email?.message || "")}
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
                "Kirim Tautan Reset"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminForgotPasswordPage;

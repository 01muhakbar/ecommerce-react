import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { loginSchema } from "@ecommerce/schemas";
import api from "../api/axios";

// --- SVG Icons as React Components ---

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

// --- Illustration Component ---

const UserIllustration = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 512 512"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z"
      fill="#e2e8f0"
    />
    <path
      d="M256 416c-29.9 0-58.1-8.8-81.8-24.4c-2.5-1.7-6-1.1-7.7 1.4s-1.1 6 1.4 7.7C194.9 417.8 225 424 256 424s61.1-6.2 88.1-13.2c2.5-1.7 3.1-5.2 1.4-7.7s-5.2-3.1-7.7-1.4C314.1 407.2 285.9 416 256 416z"
      fill="#cbd5e1"
    />
    <path
      d="M152 256c0-22.1 17.9-40 40-40h128c22.1 0 40 17.9 40 40v16c0 35.3-28.7 64-64 64H216c-35.3 0-64-28.7-64-64V256z"
      fill="#f1f5f9"
    />
    <path
      d="M216 336c-44.2 0-80-35.8-80-80v-16c0-30.9 25.1-56 56-56h128c30.9 0 56 25.1 56 56v16c0 44.2-35.8 80-80 80H216z"
      fill="#f8fafc"
    />
    <path
      d="M256 128c-35.3 0-64 28.7-64 64s28.7 64 64 64 64-28.7 64-64-28.7-64-64-64z"
      fill="#f1f5f9"
    />
    <path
      d="M256 112c-44.2 0-80 35.8-80 80s35.8 80 80 80 80-35.8 80-80-35.8-80-80-80z"
      fill="#f8fafc"
    />
    <circle cx="256" cy="192" r="48" fill="#475569" />
  </svg>
);

// --- Type Definition ---
type LoginInput = z.infer<typeof loginSchema>;

// --- Main Component ---

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation<any, Error, LoginInput>({
    mutationFn: async (data) => {
      const response = await api.post("/auth/login", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message || "Login gagal. Silakan coba lagi.";
      setError("root.serverError", { type: "manual", message });
    },
  });

  const onSubmit = (data: LoginInput) => {
    mutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Left Column: Illustration */}
          <div className="w-full md:w-1/2 p-8 sm:p-12 flex items-center justify-center bg-slate-50 order-last md:order-first">
            <div className="w-full max-w-md">
              <UserIllustration />
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Selamat Datang!
              </h1>
              <p className="text-slate-600 mb-8">
                Masuk untuk melanjutkan ke akun Anda.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {errors.root?.serverError && (
                  <div
                    className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md"
                    role="alert"
                  >
                    <p>{errors.root.serverError.message}</p>
                  </div>
                )}

                {/* Email Input */}
                <div className="relative">
                  <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="alamat@email.com"
                    className={`w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                      errors.email
                        ? "border-red-500 focus:ring-red-500"
                        : "border-slate-200 focus:border-sky-500 focus:ring-sky-500"
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">
                    {String(errors.email.message || "")}
                  </p>
                )}

                {/* Password Input */}
                <div className="relative">
                  <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder="Password"
                    className={`w-full pl-12 pr-12 py-3 bg-slate-50 border rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                      errors.password
                        ? "border-red-500 focus:ring-red-500"
                        : "border-slate-200 focus:border-sky-500 focus:ring-sky-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                  <p className="text-sm text-red-600 mt-1">
                    {String(errors.password.message || "")}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <a
                      href="#"
                      className="font-medium text-sky-600 hover:text-sky-500"
                    >
                      Lupa password?
                    </a>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full flex items-center justify-center py-3 px-4 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-300"
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

                <p className="text-center text-sm text-slate-600">
                  Belum punya akun?
                  <Link
                    to="/register"
                    className="font-medium text-sky-600 hover:text-sky-500 ml-1"
                  >
                    Daftar di sini
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

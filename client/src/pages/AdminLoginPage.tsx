import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/api/axios";
import { useAuthStore } from "@/store/authStore";
import adminLoginHeroImg from "@/assets/admin-login-hero.jpg";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const schema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Minimal 6 karakter"),
});
type FormValues = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      // endpoint login admin – sesuaikan bila berbeda
      const { data } = await api.post("/auth/admin/login", values);
      // harapkan respon: { status, data: { token, user } }
      setAuth({ isAuthenticated: true, user: data.data.user, token: data.data.token });
      navigate("/admin/dashboard");
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? "Login gagal");
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 items-center gap-10 px-8 py-12">
      {/* Kiri: gambar */}
      <div className="max-w-2xl mx-auto">
        <img
          src={adminLoginHeroImg}
          alt="Admin analytics"
          className="w-full h-auto rounded-xl shadow"
        />
      </div>

      {/* Kanan: form */}
      <div className="max-w-md mx-auto w-full">
        <h1 className="text-3xl font-semibold mb-2">Admin Login</h1>
        <p className="text-slate-600 mb-8">
          Masuk untuk mengelola dashboard toko Anda
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">Email</label>
            <input
              type="email"
              placeholder="admin@example.com"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 font-medium transition"
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="flex justify-between text-sm text-slate-600 mt-4">
          <a href="#" className="hover:underline">Forgot your password</a>
          <a href="#" className="hover:underline">Create account</a>
        </div>
      </div>
    </div>
  );
}
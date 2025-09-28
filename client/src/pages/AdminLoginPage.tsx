import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "@/api/axios";
import adminLoginHeroImg from "@/assets/admin-login-hero.jpg";

export default function AdminLoginPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: async (body: typeof f) => {
      const res = await api.post("/auth/admin/login", body);
      return res.data;
    },
    onSuccess: async () => {
      setErr(null);
      // Invalidate the query so RequireAdmin refetches it
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      // Redirect to the admin dashboard
      nav("/admin", { replace: true });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.message ??
        (e?.response?.status === 401
          ? "Email atau password salah"
          : e?.response?.status === 403
          ? "Akun tidak aktif / belum dipublish"
          : "Login gagal");
      setErr(msg);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    login.mutate({ email: f.email.trim(), password: f.password });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 items-center gap-10 px-8 py-12">
      <div className="max-w-2xl mx-auto">
        <img
          src={adminLoginHeroImg}
          alt="Admin analytics"
          className="w-full h-auto rounded-xl shadow"
        />
      </div>
      <div className="max-w-md mx-auto w-full">
        <h1 className="text-3xl font-semibold mb-2">Admin Login</h1>
        <p className="text-slate-600 mb-8">
          Masuk untuk mengelola dashboard toko Anda
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">Email</label>
            <input
              value={f.email}
              onChange={(e) => {
                setF((s) => ({ ...s, email: e.target.value }));
                if (err) setErr(null);
              }}
              type="email"
              placeholder="admin@example.com"
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Password</label>
            <input
              value={f.password}
              onChange={(e) => {
                setF((s) => ({ ...s, password: e.target.value }));
                if (err) setErr(null);
              }}
              type="password"
              placeholder="••••••••"
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
            />
          </div>
          {err && (
            <p className="text-red-600 text-sm mt-4">Login gagal: {err}</p>
          )}
          <button
            disabled={login.isPending}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 font-medium transition"
          >
            {login.isPending ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

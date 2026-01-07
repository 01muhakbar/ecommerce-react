import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import http from "@/lib/http";
import { useAuthStore } from "@/store/authStore";
import adminLoginHeroImg from "@/assets/admin-login-hero.jpg";

export default function AdminLoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { actions } = useAuthStore();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const reason = (loc.state as any)?.reason as string | undefined;

  const login = useMutation<{ user: import("@/store/authStore").User }, unknown, typeof f>({
    mutationFn: async (body) => {
      return await http<{ user: import("@/store/authStore").User }>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      setErr(null);
      actions.setUser(data.user);
      const st = loc.state as any;
      const from = st?.from;
      const target =
        typeof from === "string"
          ? from
          : from && typeof from === "object" && "pathname" in from
          ? `${from.pathname}${from.search || ""}${from.hash || ""}`
          : "/admin/dashboard";
      nav(target, { replace: true });
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
        {reason === "forbidden" && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Akses ke halaman admin memerlukan akun dengan peran admin.
            Silakan login menggunakan akun admin.
          </div>
        )}
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

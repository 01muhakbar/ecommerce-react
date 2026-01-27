import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../../api/axios.ts";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/auth/login", { email, password });
      return data;
    },
    onSuccess: () => {
      navigate("/admin/dashboard", { replace: true });
    },
  });

  const errorMsg =
    mutation.error?.response?.data?.message ||
    "Login failed. Check your credentials.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Admin Login</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to manage products.</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div>
            <label className="text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="admin@local"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          {mutation.isError ? (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {errorMsg}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {mutation.isPending ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

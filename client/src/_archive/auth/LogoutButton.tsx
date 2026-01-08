import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/axios";
import { toast } from "react-hot-toast";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogout(e?: React.MouseEvent) {
    e?.stopPropagation(); // cegah bubbling ke parent
    if (loading) return;
    setLoading(true);
    try {
      await api.post("/auth/admin/logout");
      toast.success("Berhasil logout");
      navigate("/admin/login", { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Gagal logout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="w-full pointer-events-auto rounded-lg bg-emerald-600 text-white py-2 hover:bg-emerald-700 disabled:opacity-50"
      aria-label="Logout"
    >
      {loading ? "Logging out..." : "Log Out"}
    </button>
  );
}

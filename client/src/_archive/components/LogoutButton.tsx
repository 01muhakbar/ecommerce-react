// client/src/components/LogoutButton.tsx
import { useNavigate } from "react-router-dom";
import { post } from "@/lib/http";
import { useAuthStore } from "@/store/authStore";
import { toast } from "react-hot-toast"; // Example using react-hot-toast

export function LogoutButton() {
  const navigate = useNavigate();
  const { actions } = useAuthStore();

  async function handleLogout() {
    try {
      await post("/auth/logout");
      actions.clearUser(); // Clear user state/cache
      toast.success("Logged out successfully!");
    } catch (e: any) {
      toast.error(e?.message || "Logout failed, but clearing session.");
    }
    navigate("/admin/login"); // Redirect to admin login page
  }

  return (
    <button className="border px-3 py-2 rounded-md" onClick={handleLogout}>
      Logout
    </button>
  );
}

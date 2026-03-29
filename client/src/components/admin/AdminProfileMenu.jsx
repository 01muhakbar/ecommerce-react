import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../../auth/useAuth.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const initialsFromUser = (user) => {
  const source = String(user?.name || user?.email || "A").trim();
  if (!source) return "A";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

export default function AdminProfileMenu({
  open = false,
  onToggle,
  onClose,
  containerRef,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const initials = useMemo(() => initialsFromUser(user), [user]);
  const avatarSrc = resolveAssetUrl(user?.avatarUrl || user?.avatar || "");

  const goto = (path) => {
    onClose?.();
    navigate(path);
  };

  const handleLogout = async () => {
    onClose?.();
    await logout?.();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="navbar__profile" ref={containerRef}>
      <button
        type="button"
        className="navbar__avatar navbar__avatar--button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={user?.name || user?.email || "Admin avatar"}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {open ? (
        <div className="navbar__profile-menu" role="menu">
          <button
            type="button"
            className="navbar__profile-item"
            onClick={() => goto("/admin/dashboard")}
            role="menuitem"
          >
            <LayoutDashboard size={14} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className="navbar__profile-item"
            onClick={() => goto("/admin/profile")}
            role="menuitem"
          >
            <UserRound size={14} />
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            className="navbar__profile-item navbar__profile-item--danger"
            onClick={handleLogout}
            role="menuitem"
          >
            <LogOut size={14} />
            <span>Log Out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

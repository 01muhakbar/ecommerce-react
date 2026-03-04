import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CartIconButton from "./CartIconButton.jsx";
import UserNotificationsPopup from "../user/UserNotificationsPopup.jsx";
import UserAccountMenuDropdown from "../user/UserAccountMenuDropdown.jsx";

export default function HeaderActions({ totalQty, isAuthenticated, onCartClick }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (event) => {
      if (!(event.target instanceof Node)) return;
      if (!rootRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [openMenu]);

  const handleToggleNotif = () => {
    if (!isAuthenticated) {
      navigate("/auth/login");
      return;
    }
    setOpenMenu((prev) => (prev === "notif" ? null : "notif"));
  };

  const handleToggleAccount = () => {
    if (!isAuthenticated) {
      navigate("/auth/login");
      return;
    }
    setOpenMenu((prev) => (prev === "account" ? null : "account"));
  };

  return (
    <div ref={rootRef} className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
      <CartIconButton totalQty={totalQty} tone="on-green" onClick={onCartClick} />
      <UserNotificationsPopup
        isAuthenticated={Boolean(isAuthenticated)}
        open={openMenu === "notif"}
        onToggle={handleToggleNotif}
        onClose={() => setOpenMenu(null)}
      />
      <span className="hidden h-6 w-px bg-white/35 sm:block" aria-hidden />
      <UserAccountMenuDropdown
        open={openMenu === "account"}
        onToggle={handleToggleAccount}
        onClose={() => setOpenMenu(null)}
      />
    </div>
  );
}

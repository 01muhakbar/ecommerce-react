import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CartIconButton from "./CartIconButton.jsx";
import UserNotificationsPopup from "../user/UserNotificationsPopup.jsx";
import UserAccountMenuDropdown from "../user/UserAccountMenuDropdown.jsx";

export default function HeaderActions({
  totalQty,
  isAuthenticated,
  onCartClick,
  className = "",
}) {
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
      navigate("/user/notifications");
      return;
    }
    setOpenMenu((prev) => (prev === "notif" ? null : "notif"));
  };

  const handleToggleAccount = () => {
    if (!isAuthenticated) {
      navigate("/user/my-account");
      return;
    }
    setOpenMenu((prev) => (prev === "account" ? null : "account"));
  };

  return (
    <div
      ref={rootRef}
      className={`flex shrink-0 items-center justify-end gap-1.5 sm:gap-2 ${className}`}
    >
      <div className="scale-[0.94] sm:scale-100">
        <CartIconButton totalQty={totalQty} tone="on-green" onClick={onCartClick} />
      </div>
      <div className="scale-[0.94] sm:scale-100">
        <UserNotificationsPopup
          isAuthenticated={Boolean(isAuthenticated)}
          open={openMenu === "notif"}
          onToggle={handleToggleNotif}
          onClose={() => setOpenMenu(null)}
        />
      </div>
      <span className="hidden h-6 w-px bg-white/35 md:block" aria-hidden />
      <div className="scale-[0.94] sm:scale-100">
        <UserAccountMenuDropdown
          open={openMenu === "account"}
          onToggle={handleToggleAccount}
          onClose={() => setOpenMenu(null)}
        />
      </div>
    </div>
  );
}

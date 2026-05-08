import {
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  UserRound,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getStoreCustomization } from "../../api/public/storeCustomizationPublic.ts";
import { normalizeDashboardSettingCopy } from "../../utils/dashboardSettingCopy.js";
import { useAccountAuth } from "../../auth/authDomainHooks.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

export default function UserAccountMenuDropdown({
  open,
  onToggle,
  onClose,
  triggerLabel = "My account",
}) {
  const { user } = useAccountAuth();
  const dashboardSettingQuery = useQuery({
    queryKey: ["store-customization", "dashboard-setting", "en"],
    queryFn: () => getStoreCustomization({ lang: "en", include: "dashboardSetting" }),
    staleTime: 60_000,
  });
  const dashboardSettingCopy = normalizeDashboardSettingCopy(
    dashboardSettingQuery.data?.customization?.dashboardSetting
  );
  const avatarSrc = resolveAssetUrl(user?.avatarUrl || user?.avatar || "");
  const menuItems = [
    {
      label: dashboardSettingCopy.dashboard.dashboardLabel,
      to: "/user/dashboard",
      Icon: LayoutDashboard,
    },
    {
      label: dashboardSettingCopy.dashboard.myOrderValue,
      to: "/user/my-orders",
      Icon: ClipboardList,
    },
    {
      label: dashboardSettingCopy.updateProfile.sectionTitleValue,
      to: "/user/update-profile",
      Icon: UserRound,
    },
    {
      label: dashboardSettingCopy.updateProfile.changePasswordLabel,
      to: "/user/change-password",
      Icon: KeyRound,
    },
  ];

  const handleToggle = () => {
    if (typeof onToggle === "function") onToggle();
  };

  const handleClose = () => {
    if (typeof onClose === "function") onClose();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/45 bg-transparent text-white transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 sm:h-11 sm:w-11"
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-expanded={Boolean(open)}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={user?.name || user?.email || triggerLabel}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <UserRound className="h-[18px] w-[18px]" />
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[244px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={handleClose}
              className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 last:mb-0"
            >
              <item.Icon className="h-4 w-4 text-slate-500" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  fetchUserNotifications,
  markUserNotificationRead,
} from "../../api/userNotifications.ts";

const formatTime = (value) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const getTypeLabel = (type) => {
  if (type === "ORDER_PLACED") return "Order Placed";
  if (type === "ORDER_STATUS_UPDATED") return "Status Update";
  return "Notification";
};

const getInvoiceNo = (item) => {
  const meta = item?.meta;
  if (!meta || typeof meta !== "object") return "";
  const invoiceNo = String(meta.invoiceNo || "").trim();
  return invoiceNo;
};

const toNotificationsData = (payload) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const unreadCount = Number(payload?.unreadCount || 0);
  return { items, unreadCount };
};

export default function UserNotificationsPopup({
  isAuthenticated,
  open,
  onToggle,
  onClose,
}) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  const loadNotifications = async (withLoading = true) => {
    if (withLoading) setIsLoading(true);
    setError("");
    try {
      const payload = await fetchUserNotifications(20);
      const normalized = toNotificationsData(payload);
      setItems(normalized.items);
      setUnreadCount(normalized.unreadCount);
      return normalized;
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load notifications.");
      return { items: [], unreadCount: 0 };
    } finally {
      if (withLoading) setIsLoading(false);
    }
  };

  const markUnreadItemsAsRead = async (sourceItems) => {
    const unread = sourceItems.filter((item) => !item?.isRead);
    if (unread.length === 0) return;
    setIsMarkingRead(true);
    try {
      await Promise.allSettled(
        unread.map((item) => markUserNotificationRead(Number(item.id)))
      );
      await loadNotifications(false);
    } finally {
      setIsMarkingRead(false);
    }
  };

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let active = true;
    (async () => {
      const data = await loadNotifications(true);
      if (!active) return;
      await markUnreadItemsAsRead(data.items);
    })();
    return () => {
      active = false;
    };
  }, [open, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) return;
    setItems([]);
    setUnreadCount(0);
    setError("");
  }, [isAuthenticated]);

  const handleToggle = () => {
    if (typeof onToggle === "function") {
      onToggle();
      return;
    }
    if (!isAuthenticated) {
      navigate("/auth/login");
      return;
    }
  };

  const handleClickItem = async (item) => {
    if (!item) return;
    if (!item.isRead) {
      try {
        await markUserNotificationRead(Number(item.id));
        await loadNotifications(false);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Failed to update notification.");
      }
    }

    const invoiceNo = getInvoiceNo(item);
    if (invoiceNo) {
      if (typeof onClose === "function") onClose();
      navigate(`/order/${encodeURIComponent(invoiceNo)}`);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:h-11 sm:w-11"
        aria-label="Notifications"
        title="Notifications"
        aria-expanded={Boolean(open)}
      >
        <Bell className="h-[18px] w-[18px]" />
        {isAuthenticated && unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold leading-[18px] text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <span className="text-xs text-slate-500">
              {isMarkingRead ? "Syncing..." : `${unreadCount} unread`}
            </span>
          </div>

          <div className="max-h-[420px] overflow-y-auto px-2 py-2">
            {isLoading ? (
              <p className="px-2 py-4 text-xs text-slate-500">Loading notifications...</p>
            ) : null}

            {!isLoading && error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            ) : null}

            {!isLoading && !error && items.length === 0 ? (
              <p className="px-2 py-4 text-xs text-slate-500">No notifications yet.</p>
            ) : null}

            {!isLoading && !error && items.length > 0
              ? items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleClickItem(item)}
                    className={`mb-1.5 flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50 ${
                      item.isRead ? "bg-white" : "bg-emerald-50/40"
                    }`}
                  >
                    {!item.isRead ? (
                      <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-emerald-500" />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-transparent" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-xs ${
                          item.isRead ? "font-medium text-slate-700" : "font-semibold text-slate-900"
                        }`}
                        title={item.title}
                      >
                        {item.title}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">
                          {getTypeLabel(item.type)}
                        </span>
                        <span>{formatTime(item.createdAt)}</span>
                      </span>
                    </span>
                  </button>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

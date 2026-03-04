import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import {
  fetchUserNotifications,
  markUserNotificationRead,
} from "../../api/userNotifications.ts";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatNotificationTimestamp = (input) => {
  const date = new Date(input || "");
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_LABELS[date.getMonth()] || "";
  const year = date.getFullYear();
  const hour24 = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${day} ${month}, ${year} ${hour12}:${minute} ${period}`;
};

const toLabel = (type) => {
  if (type === "ORDER_PLACED") return "Order Placed";
  if (type === "ORDER_STATUS_UPDATED") return "Status Update";
  return String(type || "Notification");
};

export default function AccountNotificationsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeReadId, setActiveReadId] = useState(0);

  const unreadItems = useMemo(() => items.filter((item) => !item.isRead), [items]);

  const loadNotifications = async (withLoading = true) => {
    if (withLoading) setIsLoading(true);
    setError("");
    try {
      const data = await fetchUserNotifications(20);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(Number(data?.unreadCount || 0));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load notifications.");
    } finally {
      if (withLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (notification) => {
    if (!notification || notification.isRead || activeReadId) return;
    const id = Number(notification.id);
    if (!Number.isFinite(id) || id <= 0) return;
    setActiveReadId(id);
    setError("");
    try {
      await markUserNotificationRead(id);
      await loadNotifications(false);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to mark notification as read.");
    } finally {
      setActiveReadId(0);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stay updated with order and account activity.
        </p>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {unreadCount} unread
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Loading notifications...
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400">
            <Bell className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700">No notifications yet.</p>
          <p className="mt-1 text-xs text-slate-500">
            New activity will appear here once available.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleMarkRead(item)}
              disabled={activeReadId === item.id}
              className={`w-full rounded-xl border p-4 text-left transition ${
                item.isRead
                  ? "border-slate-200 bg-white"
                  : "border-emerald-200 bg-emerald-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm ${
                      item.isRead ? "font-medium text-slate-700" : "font-semibold text-slate-900"
                    }`}
                    title={item.title}
                  >
                    {item.title}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {toLabel(item.type)}
                    </span>
                    <span>{formatNotificationTimestamp(item.createdAt)}</span>
                  </div>
                </div>
                {!item.isRead ? (
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && unreadItems.length > 0 ? (
        <p className="text-xs text-slate-500">Click an unread item to mark it as read.</p>
      ) : null}
    </div>
  );
}

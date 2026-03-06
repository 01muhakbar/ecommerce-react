import { useEffect, useMemo, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  clearAllUserNotifications,
  deleteUserNotification,
  fetchUserNotifications,
  markAllUserNotificationsRead,
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

const normalizeMetaString = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const lowered = normalized.toLowerCase();
  if (lowered === "undefined" || lowered === "null") return "";
  return normalized;
};

const buildNotificationTargetUrl = (item) => {
  const type = String(item?.type || "").trim().toUpperCase();
  const invoiceNo = normalizeMetaString(item?.meta?.invoiceNo);
  const orderFallback = "/account/orders";

  if (type === "ORDER_STATUS_UPDATED" || type === "ORDER_CREATED" || type === "ORDER_PLACED") {
    if (invoiceNo) {
      return `/order/${encodeURIComponent(invoiceNo)}`;
    }
    return orderFallback;
  }

  return null;
};

const isNewTabIntent = (event) =>
  Boolean(
    event?.ctrlKey ||
      event?.metaKey ||
      event?.button === 1 ||
      event?.which === 2
  );

export default function AccountNotificationsPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeReadId, setActiveReadId] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [activeDeleteId, setActiveDeleteId] = useState(0);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const pageSize = 20;

  const unreadItems = useMemo(() => items.filter((item) => !item.isRead), [items]);

  const loadNotifications = async ({ nextOffset = 0, append = false, withLoading = true } = {}) => {
    if (withLoading && !append) setIsLoading(true);
    if (append) setIsLoadingMore(true);
    setError("");
    try {
      const data = await fetchUserNotifications({ limit: pageSize, offset: nextOffset });
      const safeItems = Array.isArray(data?.items) ? data.items : [];
      setItems((previous) => (append ? [...previous, ...safeItems] : safeItems));
      setUnreadCount(Number(data?.unreadCount || 0));
      setOffset(nextOffset);
      setHasMore(safeItems.length === pageSize);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load notifications.");
    } finally {
      if (withLoading && !append) setIsLoading(false);
      if (append) setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadNotifications({ nextOffset: 0, append: false, withLoading: true });
  }, []);

  const handleMarkRead = async (notification, options = {}) => {
    if (!notification || activeReadId) return;
    const id = Number(notification.id);
    if (!Number.isFinite(id) || id <= 0) return;
    const targetUrl = buildNotificationTargetUrl(notification);
    const shouldOpenNewTab = Boolean(options?.newTab);

    if (shouldOpenNewTab && targetUrl && typeof window !== "undefined") {
      window.open(targetUrl, "_blank", "noreferrer");
    }

    setActiveReadId(id);
    setError("");
    try {
      if (!notification.isRead) {
        await markUserNotificationRead(id);
        await loadNotifications({ nextOffset: 0, append: false, withLoading: false });
      }
      if (targetUrl && !shouldOpenNewTab) {
        navigate(targetUrl);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to mark notification as read.");
    } finally {
      setActiveReadId(0);
    }
  };

  const handleNotificationClick = (event, item) => {
    if (event) {
      event.preventDefault();
    }
    handleMarkRead(item, { newTab: isNewTabIntent(event) });
  };

  const handleNotificationAuxClick = (event, item) => {
    if (!isNewTabIntent(event)) return;
    event.preventDefault();
    handleMarkRead(item, { newTab: true });
  };

  const handleMarkAllRead = async () => {
    if (isMarkingAllRead || unreadCount === 0) return;
    setIsMarkingAllRead(true);
    setError("");
    try {
      await markAllUserNotificationsRead();
      await loadNotifications({ nextOffset: 0, append: false, withLoading: false });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to mark all notifications as read.");
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    await loadNotifications({ nextOffset: offset + pageSize, append: true, withLoading: false });
  };

  const handleDeleteItem = async (event, notification) => {
    event.preventDefault();
    event.stopPropagation();
    const id = Number(notification?.id);
    if (!Number.isFinite(id) || id <= 0 || activeDeleteId === id || isClearingAll) return;
    setActiveDeleteId(id);
    setError("");
    try {
      await deleteUserNotification(id);
      await loadNotifications({ nextOffset: 0, append: false, withLoading: false });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete notification.");
    } finally {
      setActiveDeleteId(0);
    }
  };

  const handleClearAll = async () => {
    if (isClearingAll || items.length === 0) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Clear all notifications?");
      if (!confirmed) return;
    }
    setIsClearingAll(true);
    setError("");
    try {
      await clearAllUserNotifications();
      setItems([]);
      setUnreadCount(0);
      setOffset(0);
      setHasMore(false);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to clear notifications.");
    } finally {
      setIsClearingAll(false);
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

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {unreadCount} unread
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead || unreadCount === 0}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isMarkingAllRead ? "Marking..." : "Mark all read"}
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={isClearingAll || items.length === 0}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isClearingAll ? "Clearing..." : "Clear all"}
          </button>
        </div>
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
            <div
              key={item.id}
              className={`w-full rounded-xl border p-4 text-left transition ${
                item.isRead
                  ? "border-slate-200 bg-white"
                  : "border-emerald-200 bg-emerald-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={(event) => handleNotificationClick(event, item)}
                  onAuxClick={(event) => handleNotificationAuxClick(event, item)}
                  onMouseDown={(event) => {
                    if (event.button === 1) {
                      event.preventDefault();
                    }
                  }}
                  disabled={activeReadId === item.id || activeDeleteId === Number(item.id)}
                  className="min-w-0 flex-1 text-left"
                >
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
                </button>
                <div className="flex items-start gap-2">
                  {!item.isRead ? (
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => handleDeleteItem(event, item)}
                    disabled={activeDeleteId === Number(item.id) || isClearingAll}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Delete notification"
                    title="Delete notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && unreadItems.length > 0 ? (
        <p className="text-xs text-slate-500">Click an unread item to mark it as read.</p>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={!hasMore || isLoadingMore}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore ? "Loading..." : hasMore ? "Load more" : "No more notifications"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

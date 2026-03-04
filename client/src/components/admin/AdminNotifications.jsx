import { useCallback, useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import {
  deleteAdminNotification,
  fetchAdminNotifications,
  markAdminNotificationRead,
} from "../../api/adminNotifications.ts";

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

const toLabel = (type) => (type === "NEW_ORDER" ? "New Order" : type);

export default function AdminNotifications({
  open = false,
  onToggle,
  containerRef,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async (withLoading = true) => {
    if (withLoading) setLoading(true);
    setError("");
    try {
      const data = await fetchAdminNotifications(20);
      const safeItems = Array.isArray(data?.items) ? data.items : [];
      setItems(safeItems);
      setUnreadCount(Number(data?.unreadCount || 0));
      return safeItems;
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to load notifications.";
      setError(String(message));
      return [];
    } finally {
      if (withLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications(false);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    let disposed = false;

    const syncReadState = async () => {
      const freshItems = await loadNotifications();
      if (disposed) return;
      const unreadItems = freshItems.filter((item) => !item?.isRead);
      if (unreadItems.length === 0) return;
      await Promise.allSettled(
        unreadItems.map((item) => markAdminNotificationRead(Number(item.id)))
      );
      if (!disposed) {
        await loadNotifications(false);
      }
    };
    syncReadState();

    return () => {
      disposed = true;
    };
  }, [open, loadNotifications]);

  const handleToggle = () => {
    onToggle?.();
  };

  const handleDelete = async (id) => {
    try {
      await deleteAdminNotification(id);
      await loadNotifications(false);
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to delete notification.";
      setError(String(message));
    }
  };

  return (
    <div className="navbar__notify" ref={containerRef}>
      <button
        type="button"
        className="navbar__icon navbar__icon--notify"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <Bell size={18} />
        {unreadCount > 0 ? <span className="navbar__badge">{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="navbar__notify-menu" role="menu">
          <div className="navbar__notify-head">
            <p>Notifications</p>
            <span>{unreadCount} unread</span>
          </div>

          {loading ? <p className="navbar__notify-empty">Loading notifications...</p> : null}
          {!loading && error ? <p className="navbar__notify-empty">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <p className="navbar__notify-empty">No notifications yet.</p>
          ) : null}

          {!loading && !error && items.length > 0 ? (
            <div className="navbar__notify-list">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`navbar__notify-item ${item.isRead ? "" : "is-unread"}`.trim()}
                >
                  <div className="navbar__notify-main">
                    <p className="navbar__notify-title" title={item.title}>
                      {item.title}
                    </p>
                    <div className="navbar__notify-meta">
                      <span className="navbar__notify-label">{toLabel(item.type)}</span>
                      <span className="navbar__notify-time">
                        {formatNotificationTimestamp(item.createdAt)}
                      </span>
                      {!item.isRead ? <span className="navbar__notify-dot" /> : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="navbar__notify-delete"
                    aria-label="Delete notification"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

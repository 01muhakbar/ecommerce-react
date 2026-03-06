import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Trash2 } from "lucide-react";
import {
  clearAllAdminNotifications,
  deleteAdminNotification,
  fetchAdminNotificationPreferences,
  fetchAdminNotifications,
  fetchAdminUnreadCount,
  markAllAdminNotificationsRead,
  markAdminNotificationRead,
  updateAdminNotificationPreferences,
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

const toLabel = (type) => {
  if (type === "ORDER_CREATED" || type === "NEW_ORDER") return "New Order";
  return type;
};

const PAGE_LIMIT = 10;
const NOTIFICATION_TYPE_OPTIONS = [
  { value: "ORDER_CREATED", label: "Order Created" },
  { value: "ORDER_STATUS_CHANGED", label: "Order Status Changed" },
  { value: "ORDER_STATUS_UPDATED", label: "Order Status Updated" },
];
const DEFAULT_ENABLED_TYPES = NOTIFICATION_TYPE_OPTIONS.map((item) => item.value);

const normalizeEnabledTypes = (value) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set();
  value.forEach((entry) => {
    const normalized = String(entry || "").trim().toUpperCase();
    if (!normalized) return;
    unique.add(normalized);
  });
  return Array.from(unique);
};

const toMetaString = (value) => {
  const normalized = String(value ?? "").trim();
  const lowered = normalized.toLowerCase();
  if (!normalized || lowered === "undefined" || lowered === "null") return "";
  return normalized;
};

const buildNotificationTargetUrl = (item) => {
  if (!item || typeof item !== "object") return null;
  const type = String(item.type || "").trim().toUpperCase();
  const meta = item.meta && typeof item.meta === "object" ? item.meta : {};
  const invoiceNo = toMetaString(meta.invoiceNo || meta.invoice || meta.ref);
  const orderId = toMetaString(meta.orderId || meta.orderID || meta.id);

  const isOrderNotification =
    type === "ORDER_CREATED" ||
    type === "ORDER_STATUS_CHANGED" ||
    type === "ORDER_STATUS_UPDATED";

  if (!isOrderNotification) return null;
  if (invoiceNo) {
    return `/admin/orders/${encodeURIComponent(invoiceNo)}`;
  }
  if (orderId) {
    return `/admin/orders?search=${encodeURIComponent(orderId)}`;
  }
  return "/admin/orders";
};

const isNewTabIntent = (event) =>
  Boolean(event?.ctrlKey || event?.metaKey || event?.button === 1 || event?.which === 2);

export default function AdminNotifications({
  open = false,
  onToggle,
  containerRef,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState(DEFAULT_ENABLED_TYPES);
  const [draftEnabledTypes, setDraftEnabledTypes] = useState(DEFAULT_ENABLED_TYPES);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("connected");
  const openRef = useRef(Boolean(open));
  const eventSourceRef = useRef(null);
  const pollingTimerRef = useRef(null);

  useEffect(() => {
    openRef.current = Boolean(open);
  }, [open]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await fetchAdminUnreadCount();
      setUnreadCount(Number(count || 0));
    } catch {
      // keep current count on transient failures
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const startPollingUnreadCount = useCallback(() => {
    if (typeof window === "undefined" || pollingTimerRef.current) return;
    pollingTimerRef.current = window.setInterval(() => {
      fetchAdminUnreadCount()
        .then((count) => {
          setUnreadCount(Number(count || 0));
        })
        .catch(() => {
          // keep last unread count during transient polling failures
        });
    }, 60_000);
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      setIsLoadingPreferences(true);
      setPreferencesError("");
      const data = await fetchAdminNotificationPreferences();
      const normalizedEnabled = normalizeEnabledTypes(data?.enabledTypes);
      const nextEnabled =
        normalizedEnabled.length > 0 || Array.isArray(data?.enabledTypes)
          ? normalizedEnabled
          : DEFAULT_ENABLED_TYPES;
      setEnabledTypes(nextEnabled);
      setDraftEnabledTypes(nextEnabled);
    } catch (err) {
      const message =
        err?.response?.data?.message || "Failed to load notification preferences.";
      setPreferencesError(String(message));
    } finally {
      setIsLoadingPreferences(false);
    }
  }, []);

  const loadNotificationsPage = useCallback(async (options = {}) => {
    const { nextOffset = 0, append = false, withLoading = true } = options;
    if (withLoading && !append) setLoading(true);
    if (append) setIsLoadingMore(true);
    setError("");
    try {
      const data = await fetchAdminNotifications({
        limit: PAGE_LIMIT,
        offset: nextOffset,
      });
      const safeItems = Array.isArray(data?.items) ? data.items : [];
      setItems((previous) => (append ? [...previous, ...safeItems] : safeItems));
      setOffset(nextOffset);
      setHasMore(safeItems.length === PAGE_LIMIT);
      if (Number.isFinite(Number(data?.unreadCount))) {
        setUnreadCount(Number(data?.unreadCount || 0));
      }
      return safeItems;
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to load notifications.";
      setError(String(message));
      return [];
    } finally {
      if (withLoading && !append) setLoading(false);
      if (append) setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    if (!open) return undefined;
    Promise.allSettled([
      loadNotificationsPage({ nextOffset: 0, append: false, withLoading: true }),
      loadUnreadCount(),
    ]);
    return undefined;
  }, [open, loadNotificationsPage, loadUnreadCount]);

  useEffect(() => {
    if (!open) {
      setPreferencesOpen(false);
      setPreferencesError("");
    }
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return undefined;
    }

    const eventSource = new EventSource("/api/admin/notifications/stream", {
      withCredentials: true,
    });
    eventSourceRef.current = eventSource;

    const onHello = (event) => {
      try {
        const payload = JSON.parse(String(event?.data || "{}"));
        if (Number.isFinite(Number(payload?.unreadCount))) {
          setUnreadCount(Number(payload.unreadCount || 0));
        }
        setRealtimeStatus("connected");
        stopPolling();
      } catch {
        // ignore malformed payload
      }
    };

    const onNotificationNew = (event) => {
      try {
        const payload = JSON.parse(String(event?.data || "{}"));
        const nextUnreadCount = Number(payload?.unreadCount);
        const notification = payload?.notification;
        if (Number.isFinite(nextUnreadCount)) {
          setUnreadCount(nextUnreadCount);
        }
        if (!openRef.current || !notification?.id) return;
        setItems((previous) => {
          const deduped = previous.filter(
            (item) => Number(item?.id) !== Number(notification.id)
          );
          return [notification, ...deduped].slice(0, 50);
        });
      } catch {
        // ignore malformed payload
      }
    };

    const onPing = () => {};
    const onOpen = () => {
      setRealtimeStatus("connected");
      stopPolling();
    };
    const onError = () => {
      setRealtimeStatus("disconnected");
      startPollingUnreadCount();
    };

    eventSource.onopen = onOpen;
    eventSource.addEventListener("hello", onHello);
    eventSource.addEventListener("notification:new", onNotificationNew);
    eventSource.addEventListener("ping", onPing);
    eventSource.onerror = onError;

    return () => {
      stopPolling();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
      }
      eventSource.onopen = null;
      eventSource.removeEventListener("hello", onHello);
      eventSource.removeEventListener("notification:new", onNotificationNew);
      eventSource.removeEventListener("ping", onPing);
      eventSource.onerror = null;
      eventSource.close();
    };
  }, [startPollingUnreadCount, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [stopPolling]);

  const handleToggle = () => {
    onToggle?.();
  };

  const handleDelete = async (id) => {
    try {
      setIsMutating(true);
      await deleteAdminNotification(id);
      await Promise.all([
        loadNotificationsPage({ nextOffset: 0, append: false, withLoading: false }),
        loadUnreadCount(),
      ]);
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to delete notification.";
      setError(String(message));
    } finally {
      setIsMutating(false);
    }
  };

  const handleMarkRead = async (item) => {
    if (!item || item.isRead) return true;
    try {
      setIsMutating(true);
      await markAdminNotificationRead(Number(item.id));
      setItems((previous) =>
        previous.map((current) =>
          Number(current?.id) === Number(item.id)
            ? { ...current, isRead: true }
            : current
        )
      );
      await loadUnreadCount();
      return true;
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to update notification.";
      setError(String(message));
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const handleNotificationClick = async (item, event, forceNewTab = false) => {
    const target = buildNotificationTargetUrl(item);
    const hasKnownTarget = typeof target === "string";
    const safeTarget =
      hasKnownTarget && target.startsWith("/admin") ? target : "/admin/orders";
    const shouldOpenNewTab = forceNewTab || isNewTabIntent(event);

    if (shouldOpenNewTab) {
      event?.preventDefault?.();
      if (hasKnownTarget) {
        window.open(safeTarget, "_blank", "noreferrer");
      }
      if (open) onToggle?.();
      void handleMarkRead(item);
      return;
    }

    const updated = await handleMarkRead(item);
    if (!updated) return;
    if (open) onToggle?.();
    if (!hasKnownTarget) return;
    try {
      navigate(safeTarget);
    } catch {
      navigate("/admin/orders");
    }
  };

  const handleMarkAllRead = async () => {
    if (isMutating) return;
    try {
      setIsMutating(true);
      await markAllAdminNotificationsRead();
      await Promise.all([
        loadNotificationsPage({ nextOffset: 0, append: false, withLoading: false }),
        loadUnreadCount(),
      ]);
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to mark all notifications as read.";
      setError(String(message));
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearAll = async () => {
    if (isMutating) return;
    const confirmed = window.confirm("Clear all notifications?");
    if (!confirmed) return;
    try {
      setIsMutating(true);
      await clearAllAdminNotifications();
      setItems([]);
      setOffset(0);
      setHasMore(false);
      setUnreadCount(0);
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to clear notifications.";
      setError(String(message));
    } finally {
      setIsMutating(false);
    }
  };

  const handleLoadMore = async () => {
    if (isMutating || isLoadingMore || loading || !hasMore) return;
    const nextOffset = offset + PAGE_LIMIT;
    await loadNotificationsPage({ nextOffset, append: true, withLoading: false });
    await loadUnreadCount();
  };

  const handleTogglePreferenceType = (type) => {
    const normalizedType = String(type || "").trim().toUpperCase();
    if (!normalizedType) return;
    setDraftEnabledTypes((previous) => {
      if (previous.includes(normalizedType)) {
        return previous.filter((entry) => entry !== normalizedType);
      }
      return [...previous, normalizedType];
    });
  };

  const handleSavePreferences = async () => {
    if (isSavingPreferences || isLoadingPreferences) return;
    try {
      setIsSavingPreferences(true);
      setPreferencesError("");
      const data = await updateAdminNotificationPreferences({
        enabledTypes: draftEnabledTypes,
      });
      const nextEnabledTypes = normalizeEnabledTypes(data?.enabledTypes);
      setEnabledTypes(nextEnabledTypes);
      setDraftEnabledTypes(nextEnabledTypes);
      await Promise.all([
        loadUnreadCount(),
        open
          ? loadNotificationsPage({ nextOffset: 0, append: false, withLoading: false })
          : Promise.resolve(),
      ]);
      setPreferencesOpen(false);
    } catch (err) {
      const message =
        err?.response?.data?.message || "Failed to update notification preferences.";
      setPreferencesError(String(message));
    } finally {
      setIsSavingPreferences(false);
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
          <div className="px-4 pt-2 text-[11px] font-medium text-slate-400">
            Realtime: {realtimeStatus === "connected" ? "Connected" : "Disconnected"}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={isMutating || loading || items.length === 0 || unreadCount === 0}
              className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Mark all as read
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={isMutating || loading || items.length === 0}
              className="inline-flex h-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setPreferencesOpen((previous) => !previous)}
              disabled={isLoadingPreferences || isSavingPreferences}
              className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Preferences ({enabledTypes.length})
            </button>
          </div>
          {preferencesOpen ? (
            <div className="border-b border-slate-100 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Notification Preferences
              </p>
              {isLoadingPreferences ? (
                <p className="text-xs text-slate-500">Loading preferences...</p>
              ) : (
                <div className="space-y-1.5">
                  {NOTIFICATION_TYPE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 text-xs text-slate-600"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        checked={draftEnabledTypes.includes(option.value)}
                        onChange={() => handleTogglePreferenceType(option.value)}
                        disabled={isSavingPreferences}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {preferencesError ? (
                <p className="text-xs text-rose-600">{preferencesError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={isSavingPreferences || isLoadingPreferences}
                  className="inline-flex h-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingPreferences ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : null}

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
                  <div
                    className="navbar__notify-main"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      handleNotificationClick(item, event);
                    }}
                    onAuxClick={(event) => {
                      if (event.button !== 1) return;
                      handleNotificationClick(item, event, true);
                    }}
                    onMouseDown={(event) => {
                      if (event.button === 1) {
                        event.preventDefault();
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleNotificationClick(item, event);
                      }
                    }}
                  >
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
                    disabled={isMutating}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDelete(item.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {!loading && !error && items.length > 0 ? (
            <div className="border-t border-slate-100 px-4 py-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={!hasMore || isLoadingMore || isMutating}
                className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? "Loading..." : hasMore ? "Load more" : "No more notifications"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  clearAllUserNotifications,
  deleteUserNotification,
  fetchUserUnreadNotificationCount,
  fetchUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from "../../api/userNotifications.ts";

const NOTIFICATION_STREAM_CONNECT_DELAY_MS = 4000;

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
  const [activeDeleteId, setActiveDeleteId] = useState(0);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState("connected");
  const openRef = useRef(Boolean(open));
  const eventSourceRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const connectTimerRef = useRef(null);

  useEffect(() => {
    openRef.current = Boolean(open);
  }, [open]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await fetchUserUnreadNotificationCount();
      setUnreadCount(Number(count || 0));
    } catch {
      // keep existing unread count on transient failures
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (typeof window === "undefined") return;
    if (pollingTimerRef.current) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const startPollingUnreadCount = useCallback(() => {
    if (typeof window === "undefined" || pollingTimerRef.current) return;
    pollingTimerRef.current = window.setInterval(() => {
      fetchUserUnreadNotificationCount()
        .then((count) => {
          setUnreadCount(Number(count || 0));
        })
        .catch(() => {
          // keep last unread count during transient polling failures
        });
    }, 60_000);
  }, []);

  const loadNotifications = async (withLoading = true) => {
    if (withLoading) setIsLoading(true);
    setError("");
    try {
      const payload = await fetchUserNotifications({ limit: 20, offset: 0 });
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
      await markAllUserNotificationsRead();
      await loadNotifications(false);
    } finally {
      setIsMarkingRead(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadUnreadCount();
  }, [isAuthenticated, loadUnreadCount]);

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
    setRealtimeStatus("connected");
    stopPolling();
    if (connectTimerRef.current) {
      window.clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.__cleanup?.();
      eventSourceRef.current = null;
    }
  }, [isAuthenticated, stopPolling]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return undefined;
    }
    setRealtimeStatus("connecting");

    connectTimerRef.current = window.setTimeout(() => {
      const eventSource = new EventSource("/api/user/notifications/stream", {
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
            return [notification, ...deduped].slice(0, 20);
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

      eventSourceRef.current.__cleanup = () => {
        eventSource.onopen = null;
        eventSource.removeEventListener("hello", onHello);
        eventSource.removeEventListener("notification:new", onNotificationNew);
        eventSource.removeEventListener("ping", onPing);
        eventSource.onerror = null;
        eventSource.close();
      };
    }, NOTIFICATION_STREAM_CONNECT_DELAY_MS);

    return () => {
      stopPolling();
      if (connectTimerRef.current) {
        window.clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
      if (eventSourceRef.current?.__cleanup) {
        eventSourceRef.current.__cleanup();
      }
      eventSourceRef.current = null;
    };
  }, [isAuthenticated, startPollingUnreadCount, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (connectTimerRef.current) {
        window.clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.__cleanup?.();
        eventSourceRef.current = null;
      }
    };
  }, [stopPolling]);

  const handleToggle = () => {
    if (typeof onToggle === "function") {
      onToggle();
      return;
    }
    if (!isAuthenticated) {
      navigate("/user/notifications");
      return;
    }
  };

  const handleClickItem = async (item, options = {}) => {
    if (!item) return;
    const targetUrl = buildNotificationTargetUrl(item);
    const shouldOpenNewTab = Boolean(options?.newTab);

    if (shouldOpenNewTab && targetUrl && typeof window !== "undefined") {
      window.open(targetUrl, "_blank", "noreferrer");
      if (typeof onClose === "function") onClose();
    }

    if (!item.isRead) {
      try {
        await markUserNotificationRead(Number(item.id));
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Failed to update notification.");
        return;
      }
    }

    await loadNotifications(false);

    if (typeof onClose === "function") onClose();
    if (!targetUrl || shouldOpenNewTab) {
      return;
    }

    navigate(targetUrl);
  };

  const handleNotificationClick = (event, item) => {
    if (event) {
      event.preventDefault();
    }
    handleClickItem(item, { newTab: isNewTabIntent(event) });
  };

  const handleNotificationAuxClick = (event, item) => {
    if (!isNewTabIntent(event)) return;
    event.preventDefault();
    handleClickItem(item, { newTab: true });
  };

  const handleDeleteItem = async (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    const id = Number(item?.id);
    if (!Number.isFinite(id) || id <= 0 || activeDeleteId === id || isClearingAll) return;
    setActiveDeleteId(id);
    setError("");
    try {
      await deleteUserNotification(id);
      await loadNotifications(false);
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
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to clear notifications.");
    } finally {
      setIsClearingAll(false);
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
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Realtime: {realtimeStatus === "connected" ? "Connected" : "Disconnected"}
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {isMarkingRead ? "Syncing..." : `${unreadCount} unread`}
            </span>
          </div>

          <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={isClearingAll || items.length === 0}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClearingAll ? "Clearing..." : "Clear all"}
            </button>
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
                  <div
                    key={item.id}
                    className={`mb-1.5 flex items-start gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-50 ${
                      item.isRead ? "bg-white" : "bg-emerald-50/40"
                    }`}
                  >
                    {!item.isRead ? (
                      <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-emerald-500" />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-transparent" />
                    )}
                    <button
                      type="button"
                      onClick={(event) => handleNotificationClick(event, item)}
                      onAuxClick={(event) => handleNotificationAuxClick(event, item)}
                      onMouseDown={(event) => {
                        if (event.button === 1) {
                          event.preventDefault();
                        }
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
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
                    </button>
                    <button
                      type="button"
                      onClick={(event) => handleDeleteItem(event, item)}
                      disabled={activeDeleteId === Number(item.id) || isClearingAll}
                      className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Delete notification"
                      title="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

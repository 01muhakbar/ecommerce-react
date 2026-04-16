import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCheck,
  ChevronDown,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  deleteAdminNotification,
  fetchAdminNotifications,
  markAdminNotificationRead,
} from "../../api/adminNotifications.ts";

const PAGE_LIMIT = 50;

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

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "read", label: "Read" },
  { value: "unread", label: "Unread" },
];

const DEFAULT_COLUMN_VISIBILITY = {
  status: true,
  notification: true,
  date: true,
  actions: true,
};

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

const formatRelativeDate = (input) => {
  const date = new Date(input || "");
  if (Number.isNaN(date.getTime())) return "-";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
};

const toLabel = (type) => {
  if (type === "ORDER_CREATED" || type === "NEW_ORDER") return "New Order";
  return String(type || "Notification");
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
  if (invoiceNo) return `/admin/orders/${encodeURIComponent(invoiceNo)}`;
  if (orderId) return `/admin/orders?search=${encodeURIComponent(orderId)}`;
  return "/admin/orders";
};

const getNotificationAvatarLabel = (item) => {
  const title = String(item?.title || "").trim();
  if (title) {
    const parts = title.split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length > 0) {
      return parts.map((part) => part.charAt(0).toUpperCase()).join("");
    }
  }
  return "AD";
};

export default function AdminNotificationsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY);
  const [isMutating, setIsMutating] = useState(false);
  const [rowMenuOpenId, setRowMenuOpenId] = useState(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchAdminNotifications({ limit: PAGE_LIMIT, offset: 0 });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-admin-notify-status-menu]")) setStatusMenuOpen(false);
      if (!target.closest("[data-admin-notify-view-menu]")) setViewMenuOpen(false);
      if (!target.closest("[data-admin-notify-row-menu]")) setRowMenuOpenId(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !keyword ||
        String(item?.title || "")
          .toLowerCase()
          .includes(keyword) ||
        String(toLabel(item?.type || ""))
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        status === "all" ||
        (status === "read" && item?.isRead) ||
        (status === "unread" && !item?.isRead);

      return matchesSearch && matchesStatus;
    });
  }, [items, search, status]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item?.isRead).length,
    [items]
  );

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.has(Number(item.id)));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredItems.forEach((item) => next.delete(Number(item.id)));
      } else {
        filteredItems.forEach((item) => next.add(Number(item.id)));
      }
      return next;
    });
  };

  const toggleSelectRow = (id) => {
    const parsedId = Number(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(parsedId)) next.delete(parsedId);
      else next.add(parsedId);
      return next;
    });
  };

  const selectedItems = filteredItems.filter((item) => selectedIds.has(Number(item.id)));

  const handleMarkSelectedRead = async () => {
    const unreadSelected = selectedItems.filter((item) => !item?.isRead);
    if (isMutating || unreadSelected.length === 0) return;
    try {
      setIsMutating(true);
      await Promise.all(unreadSelected.map((item) => markAdminNotificationRead(Number(item.id))));
      setItems((prev) =>
        prev.map((item) =>
          selectedIds.has(Number(item.id)) ? { ...item, isRead: true } : item
        )
      );
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to mark notifications as read.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteMany = async (ids) => {
    if (isMutating || !Array.isArray(ids) || ids.length === 0) return;
    try {
      setIsMutating(true);
      await Promise.all(ids.map((id) => deleteAdminNotification(Number(id))));
      setItems((prev) => prev.filter((item) => !ids.includes(Number(item.id))));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(Number(id)));
        return next;
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete notifications.");
    } finally {
      setIsMutating(false);
      setRowMenuOpenId(null);
    }
  };

  const handleOpenNotification = async (item) => {
    if (!item) return;
    const target = buildNotificationTargetUrl(item);
    try {
      if (!item.isRead) {
        setIsMutating(true);
        await markAdminNotificationRead(Number(item.id));
        setItems((prev) =>
          prev.map((entry) =>
            Number(entry.id) === Number(item.id) ? { ...entry, isRead: true } : entry
          )
        );
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to update notification.");
      return;
    } finally {
      setIsMutating(false);
      setRowMenuOpenId(null);
    }

    if (target) navigate(target);
  };

  const viewColumns = [
    ["status", "Status"],
    ["notification", "Notification"],
    ["date", "Date"],
    ["actions", "Actions"],
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-slate-200 bg-white px-6 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-slate-500">{unreadCount} unread notifications</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleMarkSelectedRead}
              disabled={isMutating || selectedItems.filter((item) => !item.isRead).length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCheck className="h-4 w-4" />
              Mark as Read
            </button>
            <button
              type="button"
              onClick={() => handleDeleteMany(selectedItems.map((item) => Number(item.id)))}
              disabled={isMutating || selectedItems.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-300 px-4 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 max-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notifications..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
              />
            </div>

            <div className="relative" data-admin-notify-status-menu>
              <button
                type="button"
                onClick={() => {
                  setStatusMenuOpen((prev) => !prev);
                  setViewMenuOpen(false);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 border-dashed bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current/30 text-[10px]">
                  +
                </span>
                Status
              </button>
              {statusMenuOpen ? (
                <div className="absolute left-0 z-30 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                  {STATUS_OPTIONS.map((option) => {
                    const checked = status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setStatus(option.value);
                          setStatusMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                          checked ? "bg-emerald-50 text-emerald-800" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`inline-flex h-4 w-4 rounded border ${
                            checked
                              ? "border-emerald-500 bg-emerald-100"
                              : "border-slate-300 bg-white"
                          }`}
                        />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative" data-admin-notify-view-menu>
            <button
              type="button"
              onClick={() => {
                setViewMenuOpen((prev) => !prev);
                setStatusMenuOpen(false);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              View
            </button>
            {viewMenuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                {viewColumns.map(([key, label]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(columnVisibility[key])}
                      onChange={() =>
                        setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-500">Loading notifications...</div>
        ) : filteredItems.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No notifications found.</p>
            <p className="mt-1 text-xs text-slate-500">
              Try changing the search keyword or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <colgroup>
                <col style={{ width: "40px" }} />
                {columnVisibility.status ? <col style={{ width: "150px" }} /> : null}
                {columnVisibility.notification ? <col /> : null}
                {columnVisibility.date ? <col style={{ width: "160px" }} /> : null}
                {columnVisibility.actions ? <col style={{ width: "80px" }} /> : null}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                    />
                  </th>
                  {columnVisibility.status ? (
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      Status
                    </th>
                  ) : null}
                  {columnVisibility.notification ? (
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      Notification
                    </th>
                  ) : null}
                  {columnVisibility.date ? (
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      Date
                    </th>
                  ) : null}
                  {columnVisibility.actions ? (
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isSelected = selectedIds.has(Number(item.id));
                  const targetUrl = buildNotificationTargetUrl(item);
                  return (
                    <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                        />
                      </td>
                      {columnVisibility.status ? (
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${
                              item.isRead
                                ? "bg-slate-100 text-slate-600"
                                : "bg-emerald-500 text-white"
                            }`}
                          >
                            {item.isRead ? "Read" : "Unread"}
                          </span>
                        </td>
                      ) : null}
                      {columnVisibility.notification ? (
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-start gap-4">
                            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-slate-50 to-cyan-50 text-[11px] font-semibold text-slate-800">
                              {getNotificationAvatarLabel(item)}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => handleOpenNotification(item)}
                                className="truncate text-left text-[15px] font-semibold text-slate-900 transition hover:text-emerald-700"
                                title={item.title}
                              >
                                {item.title}
                              </button>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span className="inline-flex h-6 items-center rounded-full bg-emerald-500 px-2.5 text-[11px] font-semibold text-white">
                                  {toLabel(item.type)}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {formatNotificationTimestamp(item.createdAt)}
                                </span>
                              </div>
                              {targetUrl ? (
                                <div className="mt-2">
                                  <Link
                                    to={targetUrl}
                                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                                  >
                                    Open related order
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      ) : null}
                      {columnVisibility.date ? (
                        <td className="px-4 py-4 align-top text-sm text-slate-500">
                          {formatRelativeDate(item.createdAt)}
                        </td>
                      ) : null}
                      {columnVisibility.actions ? (
                        <td className="px-4 py-4 align-top">
                          <div className="flex justify-end">
                            <div className="relative" data-admin-notify-row-menu>
                              <button
                                type="button"
                                onClick={() =>
                                  setRowMenuOpenId((prev) =>
                                    prev === Number(item.id) ? null : Number(item.id)
                                  )
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {rowMenuOpenId === Number(item.id) ? (
                                <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenNotification(item)}
                                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                  >
                                    Open
                                  </button>
                                  {!item.isRead ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          setIsMutating(true);
                                          await markAdminNotificationRead(Number(item.id));
                                          setItems((prev) =>
                                            prev.map((entry) =>
                                              Number(entry.id) === Number(item.id)
                                                ? { ...entry, isRead: true }
                                                : entry
                                            )
                                          );
                                        } catch (requestError) {
                                          setError(
                                            requestError?.response?.data?.message ||
                                              "Failed to update notification."
                                          );
                                        } finally {
                                          setIsMutating(false);
                                          setRowMenuOpenId(null);
                                        }
                                      }}
                                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                    >
                                      Mark as read
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMany([Number(item.id)])}
                                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

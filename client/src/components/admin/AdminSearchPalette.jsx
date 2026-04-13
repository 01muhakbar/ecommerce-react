import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Package, Search, ShoppingCart, Store, User, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAdminStoreApplications } from "../../api/adminStoreApplications.ts";
import { useAuth } from "../../auth/useAuth.js";
import { can } from "../../constants/permissions.js";
import {
  fetchAdminCustomers,
  fetchAdminOrders,
  fetchAdminProducts,
} from "../../lib/adminApi.js";
import { getAdminPaletteItems, matchesRoute } from "../Layout/adminNavigation.jsx";
import "./AdminSearchPalette.css";

const MIN_ENTITY_QUERY_LENGTH = 2;
const ENTITY_RESULT_LIMIT = 5;

const normalize = (value) => String(value || "").trim().toLowerCase();
const text = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};
const normalizeTone = (value) => {
  const tone = normalize(value);
  if (tone === "emerald" || tone === "green" || tone === "success") return "success";
  if (tone === "amber" || tone === "yellow" || tone === "warning") return "warning";
  if (tone === "rose" || tone === "red" || tone === "danger") return "danger";
  if (tone === "sky" || tone === "blue" || tone === "info") return "info";
  return "neutral";
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const filterByKeyword = (value, keyword) => normalize(value).includes(keyword);

const buildBadge = (label, tone = "neutral") =>
  label ? { label: text(label), tone: normalizeTone(tone) } : null;

export default function AdminSearchPalette({ open = false, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmedQuery = query.trim();
  const deferredQuery = useDeferredValue(trimmedQuery);
  const keyword = normalize(deferredQuery);
  const shouldSearchEntities = keyword.length >= MIN_ENTITY_QUERY_LENGTH;

  const canViewOrders = can(user, "ORDERS_VIEW");
  const canViewProducts = can(user, "PRODUCTS_VIEW");
  const canUpdateProducts = can(user, "PRODUCTS_UPDATE");
  const canViewCustomers = can(user, "CUSTOMERS_VIEW");
  const canReviewStoreApplications = can(user, "STORE_APPLICATIONS_REVIEW");

  const paletteItems = useMemo(() => getAdminPaletteItems(user), [user]);

  const pageItems = useMemo(() => {
    if (!keyword) {
      return paletteItems.map((item) => ({
        ...item,
        group: "Pages",
        meta: item.parentLabel ? `${item.section} · ${item.parentLabel}` : item.section,
        routeLabel: item.to.replace("/admin", "") || "/",
      }));
    }

    return paletteItems
      .filter((item) => {
        const label = normalize(item.label);
        const section = normalize(item.section);
        const parent = normalize(item.parentLabel);
        return (
          label.includes(keyword) ||
          section.includes(keyword) ||
          parent.includes(keyword) ||
          item.keywords.includes(keyword)
        );
      })
      .map((item) => ({
        ...item,
        group: "Pages",
        meta: item.parentLabel ? `${item.section} · ${item.parentLabel}` : item.section,
        routeLabel: item.to.replace("/admin", "") || "/",
      }));
  }, [keyword, paletteItems]);

  const [ordersQuery, productsQuery, customersQuery, storeApplicationsQuery] = useQueries({
    queries: [
      {
        queryKey: ["admin-search-palette", "orders", keyword],
        queryFn: () =>
          fetchAdminOrders({
            page: 1,
            limit: ENTITY_RESULT_LIMIT,
            search: deferredQuery,
          }),
        enabled: open && shouldSearchEntities && canViewOrders,
        staleTime: 30_000,
      },
      {
        queryKey: ["admin-search-palette", "products", keyword],
        queryFn: () =>
          fetchAdminProducts({
            page: 1,
            limit: ENTITY_RESULT_LIMIT,
            q: deferredQuery,
          }),
        enabled: open && shouldSearchEntities && canViewProducts,
        staleTime: 30_000,
      },
      {
        queryKey: ["admin-search-palette", "customers", keyword],
        queryFn: () =>
          fetchAdminCustomers({
            page: 1,
            limit: ENTITY_RESULT_LIMIT,
            q: deferredQuery,
          }),
        enabled: open && shouldSearchEntities && canViewCustomers,
        staleTime: 30_000,
      },
      {
        queryKey: ["admin-search-palette", "store-applications", keyword],
        queryFn: () => fetchAdminStoreApplications({ page: 1, limit: 20 }),
        enabled: open && shouldSearchEntities && canReviewStoreApplications,
        staleTime: 60_000,
      },
    ],
  });

  const orderResults = useMemo(() => {
    const items = Array.isArray(ordersQuery.data?.data) ? ordersQuery.data.data : [];
    return items
      .filter((entry) => text(entry?.invoiceNo || entry?.invoice))
      .slice(0, ENTITY_RESULT_LIMIT)
      .map((entry) => ({
        id: `order-${entry.id || entry.invoiceNo}`,
        to: entry?.invoiceNo || entry?.invoice
          ? `/admin/orders/${encodeURIComponent(entry.invoiceNo || entry.invoice)}`
          : "/admin/orders",
        icon: ShoppingCart,
        label: text(entry.invoiceNo || entry.invoice, `Order #${entry.id}`),
        meta: text(entry.customerName || entry.customerEmail, "Guest checkout"),
        routeLabel: formatCurrency(entry.totalAmount || 0),
        badge: buildBadge(
          entry?.contract?.statusSummary?.label || entry?.paymentStatusMeta?.label,
          entry?.contract?.statusSummary?.tone || entry?.paymentStatusMeta?.tone
        ),
      }));
  }, [ordersQuery.data]);

  const productResults = useMemo(() => {
    const items = Array.isArray(productsQuery.data?.data) ? productsQuery.data.data : [];
    return items.slice(0, ENTITY_RESULT_LIMIT).map((entry) => ({
      id: `product-${entry.id}`,
      to:
        canUpdateProducts && entry?.id
          ? `/admin/catalog/products/${encodeURIComponent(entry.id)}`
          : "/admin/catalog/products",
      icon: Package,
      label: text(entry.name, `Product #${entry.id}`),
      meta: text(entry.slug, `ID #${entry.id}`),
      routeLabel: `ID #${entry.id}`,
      badge: buildBadge(
        entry?.sellerSubmission?.status === "submitted"
          ? "Submitted"
          : entry?.sellerSubmission?.status === "needs_revision"
            ? "Needs revision"
            : entry?.published
              ? "Published"
              : "Draft",
        entry?.sellerSubmission?.status === "needs_revision"
          ? "warning"
          : entry?.sellerSubmission?.status === "submitted"
            ? "info"
            : entry?.published
              ? "success"
              : "neutral"
      ),
    }));
  }, [canUpdateProducts, productsQuery.data]);

  const customerResults = useMemo(() => {
    const items = Array.isArray(customersQuery.data?.data) ? customersQuery.data.data : [];
    return items.slice(0, ENTITY_RESULT_LIMIT).map((entry) => ({
      id: `customer-${entry.id}`,
      to: `/admin/customers/${encodeURIComponent(entry.id)}`,
      icon: User,
      label: text(entry.name, `Customer #${entry.id}`),
      meta: text(entry.email, text(entry.phone || entry.phoneNumber, "No contact email")),
      routeLabel:
        Number(entry?.ordersCount || 0) > 0
          ? `${Number(entry.ordersCount)} orders`
          : "No orders yet",
      badge: buildBadge(
        text(entry?.status, "active").replace(/_/g, " "),
        text(entry?.status, "active") === "blocked"
          ? "danger"
          : text(entry?.status, "active") === "pending_verification"
            ? "info"
            : text(entry?.status, "active") === "inactive"
              ? "neutral"
              : "success"
      ),
    }));
  }, [customersQuery.data]);

  const storeResults = useMemo(() => {
    const items = Array.isArray(storeApplicationsQuery.data?.items)
      ? storeApplicationsQuery.data.items
      : [];

    return items
      .filter((entry) => {
        if (!keyword) return true;
        return [
          entry?.storeInformation?.storeName,
          entry?.storeInformation?.storeSlug,
          entry?.applicant?.accountName,
          entry?.applicant?.accountEmail,
        ].some((value) => filterByKeyword(value, keyword));
      })
      .slice(0, ENTITY_RESULT_LIMIT)
      .map((entry) => ({
        id: `store-application-${entry.id}`,
        to: `/admin/store/applications/${encodeURIComponent(entry.id)}`,
        icon: Store,
        label: text(entry?.storeInformation?.storeName, `Application #${entry.id}`),
        meta: text(
          entry?.storeInformation?.storeSlug,
          text(entry?.applicant?.accountName, "Store application")
        ),
        routeLabel: `Application #${entry.id}`,
        badge: buildBadge(entry?.statusMeta?.label, entry?.statusMeta?.tone),
      }));
  }, [keyword, storeApplicationsQuery.data]);

  const isEntityLoading =
    ordersQuery.isFetching ||
    productsQuery.isFetching ||
    customersQuery.isFetching ||
    storeApplicationsQuery.isFetching;

  const groupedItems = useMemo(() => {
    let flatIndex = 0;
    const groups = [];

    const pushGroup = (section, items) => {
      if (!Array.isArray(items) || items.length === 0) return;
      groups.push({
        section,
        items: items.map((item) => ({ ...item, flatIndex: flatIndex++ })),
      });
    };

    pushGroup("Pages", pageItems);
    if (shouldSearchEntities) {
      pushGroup("Orders", orderResults);
      pushGroup("Products", productResults);
      pushGroup("Customers", customerResults);
      pushGroup("Stores", storeResults);
    }

    return groups;
  }, [
    customerResults,
    orderResults,
    pageItems,
    productResults,
    shouldSearchEntities,
    storeResults,
  ]);

  const flatItems = useMemo(
    () => groupedItems.flatMap((group) => group.items),
    [groupedItems]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    if (activeIndex < flatItems.length) return;
    setActiveIndex(flatItems.length === 0 ? 0 : flatItems.length - 1);
  }, [activeIndex, flatItems.length, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (flatItems.length === 0 ? 0 : (prev + 1) % flatItems.length));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) =>
          flatItems.length === 0 ? 0 : (prev - 1 + flatItems.length) % flatItems.length
        );
        return;
      }
      if (event.key === "Enter") {
        const nextItem = flatItems[activeIndex];
        if (!nextItem) return;
        event.preventDefault();
        navigate(nextItem.to);
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, flatItems, navigate, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="admin-search-palette"
      role="presentation"
      onMouseDown={() => onClose?.()}
    >
      <div
        className="admin-search-palette__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Admin search palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-search-palette__header">
          <div className="admin-search-palette__input-shell">
            <Search className="admin-search-palette__input-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="admin-search-palette__input"
              placeholder="Type a command or search..."
              aria-label="Search admin navigation and records"
            />
          </div>
          <button
            type="button"
            className="admin-search-palette__close"
            onClick={() => onClose?.()}
            aria-label="Close search palette"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="admin-search-palette__content">
          <div className="admin-search-palette__helper">
            {shouldSearchEntities ? (
              isEntityLoading ? (
                <span>Searching orders, products, customers, and store records...</span>
              ) : (
                <span>Quick results include pages and matching admin records.</span>
              )
            ) : (
              <span>Type at least 2 characters to search admin records.</span>
            )}
          </div>

          {groupedItems.length === 0 && !isEntityLoading ? (
            <div className="admin-search-palette__empty">
              <p>No matching admin pages or records.</p>
              <span>Try another keyword.</span>
            </div>
          ) : (
            groupedItems.map((group) => (
              <section key={group.section} className="admin-search-palette__group">
                <p className="admin-search-palette__group-title">{group.section}</p>
                <div className="admin-search-palette__list" role="listbox">
                  {group.items.map((item) => {
                    const isActive = item.flatIndex === activeIndex;
                    const isCurrent = matchesRoute(item.to, pathname);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`admin-search-palette__item ${
                          isActive ? "is-active" : ""
                        } ${isCurrent ? "is-current" : ""}`}
                        onMouseEnter={() => setActiveIndex(item.flatIndex)}
                        onClick={() => {
                          navigate(item.to);
                          onClose?.();
                        }}
                      >
                        <span className="admin-search-palette__item-icon" aria-hidden="true">
                          <Icon className="admin-search-palette__item-icon-svg" />
                        </span>
                        <span className="admin-search-palette__item-copy">
                          <span className="admin-search-palette__item-label">
                            {item.label}
                          </span>
                          {item.meta ? (
                            <span className="admin-search-palette__item-meta">
                              {item.meta}
                            </span>
                          ) : null}
                        </span>
                        <span className="admin-search-palette__item-side">
                          {item.badge ? (
                            <span
                              className={`admin-search-palette__badge admin-search-palette__badge--${item.badge.tone}`}
                            >
                              {item.badge.label}
                            </span>
                          ) : null}
                          {item.routeLabel ? (
                            <span className="admin-search-palette__item-route">
                              {item.routeLabel}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

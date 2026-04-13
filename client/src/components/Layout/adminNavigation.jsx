import { can } from "../../constants/permissions.js";

export const IconGrid = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
  </svg>
);

export const IconBoxes = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M4 7l8-4 8 4-8 4-8-4Z" />
    <path d="M4 7v10l8 4 8-4V7" />
    <path d="M12 11v10" />
  </svg>
);

export const IconTag = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M20 10.5 11.5 19 4 11.5V4h7.5L20 10.5Z" />
    <circle cx="8.25" cy="8.25" r="1.5" />
  </svg>
);

export const IconLayers = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M12 4 21 8.5 12 13 3 8.5 12 4Z" />
    <path d="M5.5 12 12 15.5 18.5 12" />
    <path d="M5.5 15.5 12 19 18.5 15.5" />
  </svg>
);

export const IconGift = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M4 10h16v10H4V10Z" />
    <path d="M2.5 7.5h19v4h-19v-4Z" />
    <path d="M12 7.5V20" />
    <path d="M12 7.5H8.75A2.25 2.25 0 1 1 11 5.25c0 .83-.33 1.58-.86 2.12L12 7.5Z" />
    <path d="M12 7.5h3.25A2.25 2.25 0 1 0 13 5.25c0 .83.33 1.58.86 2.12L12 7.5Z" />
  </svg>
);

export const IconTarget = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
  </svg>
);

export const IconUsers = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle cx="9" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M4 19c0-3 3-5 6-5s6 2 6 5" />
    <path d="M14 19c0-2.2 2.2-4 5-4" />
  </svg>
);

export const IconReceipt = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
    <path d="M9 7h6M9 11h6M9 15h4" />
  </svg>
);

export const IconStaff = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

export const IconSettings = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
    <path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.6-2-3.4-2.4.7a8 8 0 0 0-1.7-1l-.4-2.5H10l-.4 2.5a8 8 0 0 0-1.7 1l-2.4-.7-2 3.4 2 1.6a7.9 7.9 0 0 0 .1 2l-2 1.6 2 3.4 2.4-.7a8 8 0 0 0 1.7 1l.4 2.5h4l.4-2.5a8 8 0 0 0 1.7-1l2.4.7 2-3.4-2-1.6Z" />
  </svg>
);

export const IconGlobe = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9Z" />
  </svg>
);

export const IconStore = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M4 7h16l-1.5 5H5.5L4 7Z" />
    <path d="M6 12v8h12v-8" />
    <path d="M9 12v8M15 12v8" />
  </svg>
);

export const ADMIN_NAVIGATION = [
  {
    section: "General",
    label: "Dashboard",
    to: "/admin",
    icon: IconGrid,
    perm: "DASHBOARD_VIEW",
  },
  {
    section: "Catalog",
    label: "Products",
    to: "/admin/catalog/products",
    icon: IconBoxes,
    perm: "PRODUCTS_VIEW",
  },
  {
    section: "Catalog",
    label: "Categories",
    to: "/admin/catalog/categories",
    icon: IconTag,
    perm: "CATEGORIES_CRUD",
  },
  {
    section: "Catalog",
    label: "Attributes",
    to: "/admin/catalog/attributes",
    icon: IconLayers,
    perm: "ATTRIBUTES_CRUD",
  },
  {
    section: "Catalog",
    label: "Coupons",
    to: "/admin/catalog/coupons",
    icon: IconGift,
    perm: "COUPONS_CRUD",
  },
  {
    section: "Catalog",
    label: "Campaigns",
    icon: IconTarget,
    disabled: true,
  },
  {
    section: "Sales",
    label: "Customers",
    to: "/admin/customers",
    icon: IconUsers,
    perm: "CUSTOMERS_VIEW",
  },
  {
    section: "Sales",
    label: "Orders",
    to: "/admin/orders",
    icon: IconReceipt,
    perm: "ORDERS_VIEW",
  },
  {
    section: "Workspace",
    label: "All Accounts",
    to: "/admin/all-accounts",
    icon: IconStaff,
    perm: "STAFF_MANAGE",
  },
  {
    section: "Workspace",
    label: "Settings",
    to: "/admin/settings",
    icon: IconSettings,
    perm: "SETTINGS_MANAGE",
  },
  {
    section: "Workspace",
    label: "International",
    icon: IconGlobe,
    hasCaret: true,
    children: [
      { label: "Languages", to: "/admin/international/languages", perm: "SETTINGS_MANAGE" },
      { label: "Currencies", to: "/admin/international/currencies", perm: "SETTINGS_MANAGE" },
    ],
  },
  {
    section: "Workspace",
    label: "Online Store",
    icon: IconStore,
    hasCaret: true,
    children: [
      { label: "View Store", to: "/", perm: "DASHBOARD_VIEW" },
      {
        label: "Store Customization",
        to: "/admin/store/customization",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Store Profile",
        to: "/admin/online-store/store-profile",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Store Settings",
        to: "/admin/store/store-settings",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Store Payment",
        to: "/admin/store/payment-profiles",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Payment Audit",
        to: "/admin/online-store/payment-audit",
        perm: "DASHBOARD_VIEW",
      },
      {
        label: "Shipping Reconciliation",
        to: "/admin/online-store/shipping-reconciliation",
        perm: "DASHBOARD_VIEW",
      },
      {
        label: "Store Applications",
        to: "/admin/store/applications",
        perm: "STORE_APPLICATIONS_REVIEW",
      },
    ],
  },
];

export const matchesRoute = (targetPath, currentPath) => {
  if (!targetPath) return false;
  if (targetPath === currentPath) return true;
  if (targetPath === "/") return currentPath === "/";
  return currentPath.startsWith(`${targetPath}/`);
};

export const getAllowedAdminNavigation = (user) =>
  ADMIN_NAVIGATION.map((item) => {
    if (!item.children) {
      return item.perm ? (can(user, item.perm) ? item : null) : item;
    }
    const children = item.children.filter((child) =>
      child.perm ? can(user, child.perm) : true
    );
    if (children.length === 0) {
      return null;
    }
    return { ...item, children };
  }).filter(Boolean);

export const getAdminPaletteItems = (user) =>
  getAllowedAdminNavigation(user).flatMap((item) => {
    if (Array.isArray(item.children)) {
      return item.children
        .filter((child) => child.to && child.to.startsWith("/admin"))
        .map((child) => ({
          id: `${item.section}-${item.label}-${child.label}`,
          section: item.section,
          label: child.label,
          to: child.to,
          icon: item.icon,
          parentLabel: item.label,
          keywords: [item.section, item.label, child.label].join(" ").toLowerCase(),
        }));
    }

    if (!item.to || item.disabled || !item.to.startsWith("/admin")) {
      return [];
    }

    return [
      {
        id: `${item.section}-${item.label}`,
        section: item.section,
        label: item.label,
        to: item.to,
        icon: item.icon,
        parentLabel: null,
        keywords: [item.section, item.label].join(" ").toLowerCase(),
      },
    ];
  });

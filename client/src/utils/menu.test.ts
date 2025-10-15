import { describe, it, expect } from "vitest";
import { filterMenu, type MenuItem } from "./menu";

const ITEMS: MenuItem[] = [
  { key: "dashboard", to: "/admin/dashboard", label: "Dashboard" },
  { key: "catalog", to: "/admin/catalog", label: "Catalog" },
  { key: "orders", to: "/admin/orders", label: "Orders" },
  { key: "customers", to: "/admin/customers", label: "Customers" },
  // Our Staff hanya Super Admin
  {
    key: "our-staff",
    to: "/admin/our-staff",
    label: "Our Staff",
    minRole: "super admin",
  },
  { key: "settings", to: "/admin/settings", label: "Settings" },
];

describe("filterMenu()", () => {
  it("Super Admin melihat SEMUA item termasuk 'Our Staff' walau routes kosong", () => {
    const me = { role: "Super Admin", routes: [] }; // huruf besar/variasi harus tetap lolos
    const items = filterMenu(ITEMS, me);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("our-staff");
    expect(keys).toEqual(ITEMS.map((i) => i.key));
  });

  it("Admin melihat item yang ada di allowlist routes saja; tidak boleh melihat 'Our Staff'", () => {
    const me = { role: "admin", routes: ["dashboard", "orders", "settings"] };
    const items = filterMenu(ITEMS, me);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("dashboard");
    expect(keys).toContain("orders");
    expect(keys).toContain("settings");
    expect(keys).not.toContain("our-staff"); // minRole super admin → tidak lolos
    expect(keys).not.toContain("catalog"); // tidak ada di routes
  });

  it("Staff hanya melihat item di routes dan yang lolos minRole", () => {
    const me = { role: "staff", routes: ["dashboard", "customers", "catalog"] };
    const items = filterMenu(ITEMS, me);
    const keys = items.map((i) => i.key);
    expect(keys).toEqual(["dashboard", "catalog", "customers"]);
    expect(keys).not.toContain("our-staff"); // minRole super admin → tidak lolos
    expect(keys).not.toContain("orders"); // tidak di routes
  });

  it("User biasa hanya melihat item di routes; 'Our Staff' tetap tersembunyi", () => {
    const me = { role: "user", routes: ["dashboard"] };
    const items = filterMenu(ITEMS, me);
    const keys = items.map((i) => i.key);
    expect(keys).toEqual(["dashboard"]);
    expect(keys).not.toContain("our-staff");
  });

  it("Jika me/routes tidak ada, non-super-admin tidak melihat apa pun", () => {
    const me = { role: "admin" }; // routes undefined
    const items = filterMenu(ITEMS, me);
    expect(items.length).toBe(0);
  });

  it("MinRole bekerja: bila item menetapkan minRole 'admin', role 'staff' harus ditolak walau di routes", () => {
    const withMin = [
      ...ITEMS,
      {
        key: "internal-report",
        to: "/admin/internal-report",
        label: "Internal",
        minRole: "admin" as const,
      },
    ];
    const staff = { role: "staff", routes: ["dashboard", "internal-report"] };
    const items = filterMenu(withMin, staff);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("dashboard");
    expect(keys).not.toContain("internal-report"); // gagal minRole
  });
});

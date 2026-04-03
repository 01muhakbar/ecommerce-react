import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

// Mock store auth
let CURRENT_USER: any = null;
vi.mock("@/store/authStore", () => {
  return {
    useAuth: () => ({
      user: CURRENT_USER, // akan diset dinamis pada each
    }),
  };
});

// Komponen yang dites
import Sidebar from "../admin/Sidebar";

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );
}

describe("<Sidebar /> role visibility", () => {
  beforeEach(() => {
    CURRENT_USER = null;
  });

  it("Super Admin melihat 'All Accounts'", () => {
    CURRENT_USER = { role: "Super Admin", routes: [] };
    renderSidebar();
    expect(screen.getByText(/All Accounts/i)).toBeInTheDocument();
  });

  it("Admin tidak melihat 'All Accounts' meski punya routes lain", () => {
    CURRENT_USER = {
      role: "admin",
      routes: ["dashboard", "customers", "settings"],
    };
    renderSidebar();
    expect(screen.queryByText(/All Accounts/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
  });

  it("Staff tidak melihat 'All Accounts' walau memasukkan key di routes", () => {
    CURRENT_USER = { role: "staff", routes: ["our-staff", "dashboard"] };
    renderSidebar();
    // tetap tidak tampil karena minRole super admin
    expect(screen.queryByText(/All Accounts/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
  });
});

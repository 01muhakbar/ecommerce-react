import { Outlet } from "react-router-dom";
import Sidebar from "../Layout/Sidebar.jsx";
import Navbar from "../Layout/Navbar.jsx";
import "../Layout/MainLayout.css";

export default function AdminLayout() {
  return (
    <div className="layout admin-shell">
      <Sidebar />
      <div className="layout__content admin-content">
        <Navbar />
        <main className="layout__page admin-page-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

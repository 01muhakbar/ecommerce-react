import { Outlet } from "react-router-dom";
import Sidebar from "../Layout/Sidebar.jsx";
import Navbar from "../Layout/Navbar.jsx";
import "../Layout/MainLayout.css";

export default function AdminLayout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout__content">
        <Navbar />
        <main className="layout__page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

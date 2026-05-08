import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Navbar from "./Navbar.jsx";
import "./MainLayout.css";

export default function MainLayout() {
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

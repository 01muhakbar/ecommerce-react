import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const MENU = [
  { label: "Dashboard", to: "/" },
  { label: "Products", to: "/products" },
  { label: "Orders", to: "/orders" },
  { label: "Customers", to: "/customers" },
  { label: "Settings", to: "/settings" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">Ecom Admin</div>
      <nav className="sidebar__menu">
        {MENU.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? "is-active" : ""}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

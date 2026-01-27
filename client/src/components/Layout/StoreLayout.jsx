import { Link, Outlet } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import "./StoreLayout.css";

export default function StoreLayout() {
  const totalQty = useCartStore((state) => state.totalQty);
  return (
    <div className="store-layout">
      <header className="store-layout__header">
        <div className="store-layout__brand">Store</div>
        <nav className="store-layout__nav" aria-label="Storefront">
          <Link to="/" className="store-layout__link">
            Home
          </Link>
          <Link to="/cart" className="store-layout__link store-layout__cart-link">
            Cart
            {totalQty > 0 ? (
              <span className="store-layout__cart-badge" aria-label="Cart items">
                {totalQty}
              </span>
            ) : null}
          </Link>
          <Link to="/admin/login" className="store-layout__link store-layout__link--admin">
            Admin
          </Link>
        </nav>
      </header>
      <main className="store-layout__main">
        <Outlet />
      </main>
      <footer className="store-layout__footer">Footer placeholder</footer>
    </div>
  );
}

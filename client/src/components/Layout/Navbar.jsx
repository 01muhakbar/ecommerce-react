import "./Navbar.css";

export default function Navbar() {
  return (
    <header className="navbar">
      <input
        className="navbar__search"
        type="text"
        placeholder="Search..."
        aria-label="Search"
      />
      <div className="navbar__actions">
        <button className="navbar__icon" aria-label="Notifications">
          🔔
        </button>
        <div className="navbar__avatar" aria-label="User avatar">
          AD
        </div>
      </div>
    </header>
  );
}

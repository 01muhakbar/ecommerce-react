import "./Navbar.css";

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__left">
        <button className="navbar__menu" aria-label="Toggle menu">
          <span />
          <span />
          <span />
        </button>
      </div>
      <div className="navbar__actions">
        <button className="navbar__lang" type="button">
          GB ENGLISH
        </button>
        <button className="navbar__icon" aria-label="Toggle theme">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a6.8 6.8 0 0 0 11.5 11.5Z" />
          </svg>
        </button>
        <button className="navbar__icon navbar__icon--notify" aria-label="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" />
            <path d="M13.7 20a2 2 0 0 1-3.4 0" />
          </svg>
          <span className="navbar__badge">26</span>
        </button>
        <div className="navbar__avatar" aria-label="User avatar">
          A
        </div>
      </div>
    </header>
  );
}

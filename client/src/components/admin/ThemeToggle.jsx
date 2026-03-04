import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ theme = "light", onToggle }) {
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className={`navbar__icon navbar__icon--theme ${isDark ? "is-dark" : ""}`}
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      <Icon size={18} />
    </button>
  );
}

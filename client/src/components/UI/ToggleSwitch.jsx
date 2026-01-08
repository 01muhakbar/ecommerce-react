import "./ToggleSwitch.css";
import { useAuth } from "../../auth/useAuth.js";

export default function ToggleSwitch({ checked, disabled }) {
  const { user, role } = useAuth();
  const currentRole = role || user?.role;
  const isAdmin = currentRole === "admin";
  const isDisabled = disabled || !isAdmin;

  return (
    <label
      className={`toggle ${checked ? "is-on" : ""}`}
      style={{
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
      }}
    >
      <input type="checkbox" checked={checked} readOnly disabled={isDisabled} />
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
    </label>
  );
}

import "./ActionButtons.css";
import { useAuth } from "../../auth/useAuth.js";

export default function ActionButtons({ canEdit, onEdit, onDelete }) {
  const { user, role } = useAuth();
  const currentRole = role || user?.role;
  const isAdmin = currentRole === "admin";
  const allowEdit = typeof canEdit === "boolean" ? canEdit : isAdmin;

  return (
    <div className="action-buttons">
      <button
        className="action-buttons__btn"
        aria-label="Edit"
        type="button"
        disabled={!allowEdit}
        title={!allowEdit ? "Only admin can perform this action" : undefined}
        onClick={() => onEdit?.()}
      >
        ??
      </button>
      <button
        className="action-buttons__btn action-buttons__btn--danger"
        aria-label="Delete"
        type="button"
        disabled={!allowEdit}
        title={!allowEdit ? "Only admin can perform this action" : undefined}
        onClick={() => onDelete?.()}
      >
        ???
      </button>
    </div>
  );
}

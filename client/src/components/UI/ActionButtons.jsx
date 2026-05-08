import "./ActionButtons.css";
import { useAuth } from "../../auth/useAuth.js";

const IconEdit = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path
      d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-.2-.2a2 2 0 0 0-2.8 0L5 16v4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 6.5l4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconTrash = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path
      d="M4 7h16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M10 11v6M14 11v6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M6 7l1 14h10l1-14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M9 7V4h6v3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
        title={!allowEdit ? "Only admin can perform this action" : "Edit"}
        onClick={() => onEdit?.()}
      >
        <IconEdit className="action-buttons__icon" />
      </button>

      <button
        className="action-buttons__btn action-buttons__btn--danger"
        aria-label="Delete"
        type="button"
        disabled={!allowEdit}
        title={!allowEdit ? "Only admin can perform this action" : "Delete"}
        onClick={() => onDelete?.()}
      >
        <IconTrash className="action-buttons__icon" />
      </button>
    </div>
  );
}

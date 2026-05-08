import "./StatusBadge.css";

const STATUS_TONE = {
  pending: "neutral",
  paid: "info",
  processing: "info",
  shipped: "warn",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
  cancel: "danger",
  selling: "success",
  soldout: "danger",
};

const toTitleCase = (value) =>
  value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function StatusBadge({ status }) {
  const key = String(status || "pending").toLowerCase();
  const tone = STATUS_TONE[key] || "neutral";
  const label = toTitleCase(key);
  return (
    <span className={`status-badge status-badge--${tone}`}>{label}</span>
  );
}

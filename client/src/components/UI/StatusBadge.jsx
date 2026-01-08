import "./StatusBadge.css";

const STATUS_MAP = {
  pending: "status-badge--pending",
  processing: "status-badge--processing",
  delivered: "status-badge--delivered",
  cancel: "status-badge--cancel",
  shipped: "status-badge--processing",
  completed: "status-badge--delivered",
  cancelled: "status-badge--cancel",
  selling: "status-badge--selling",
  soldout: "status-badge--soldout",
};

export default function StatusBadge({ status }) {
  const key = String(status || "").toLowerCase();
  const cls = STATUS_MAP[key] || "status-badge--pending";
  return <span className={`status-badge ${cls}`}>{status}</span>;
}

import "./OrderStatusCard.css";

export default function OrderStatusCard({ title, value }) {
  return (
    <div className="order-status-card">
      <div className="order-status-card__title" style={{ textAlign: "left" }}>
        {title}
      </div>
      <div className="order-status-card__value" style={{ textAlign: "left" }}>
        {value}
      </div>
    </div>
  );
}

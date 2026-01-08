import "./OrderFilters.css";

export default function OrderFilters({ filters, onChange }) {
  const handleChange = (key) => (event) => {
    onChange({ ...filters, [key]: event.target.value });
  };

  return (
    <div className="order-filters">
      <div className="order-filters__row">
        <input
          className="order-filters__input"
          type="text"
          placeholder="Search by Customer Name"
          value={filters.search}
          onChange={handleChange("search")}
        />
        <select
          className="order-filters__select"
          value={filters.status}
          onChange={handleChange("status")}
        >
          <option value="">Status (All)</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="delivered">Delivered</option>
          <option value="cancel">Cancel</option>
        </select>
        <select
          className="order-filters__select"
          value={filters.orderLimit}
          onChange={handleChange("orderLimit")}
        >
          <option value="">Order Limits</option>
          <option value="below-200k">Below Rp 200K</option>
          <option value="200-500k">Rp 200K - Rp 500K</option>
          <option value="above-500k">Above Rp 500K</option>
        </select>
        <select
          className="order-filters__select"
          value={filters.method}
          onChange={handleChange("method")}
        >
          <option value="">Method (All)</option>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Transfer">Transfer</option>
        </select>
        <button className="order-filters__btn order-filters__btn--ghost">
          Download All Orders
        </button>
      </div>
      <div className="order-filters__row">
        <div className="order-filters__field">
          <label className="order-filters__label">Start Date</label>
          <input
            className="order-filters__input"
            type="date"
            value={filters.startDate}
            onChange={handleChange("startDate")}
          />
        </div>
        <div className="order-filters__field">
          <label className="order-filters__label">End Date</label>
          <input
            className="order-filters__input"
            type="date"
            value={filters.endDate}
            onChange={handleChange("endDate")}
          />
        </div>
        <button className="order-filters__btn">Filter</button>
        <button
          className="order-filters__btn order-filters__btn--ghost"
          type="button"
          onClick={() => onReset?.()}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

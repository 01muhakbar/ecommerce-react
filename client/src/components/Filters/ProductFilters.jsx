import "./ProductFilters.css";

export default function ProductFilters({ filters, onChange, onReset }) {
  const handleChange = (key) => (event) => {
    onChange({ ...filters, [key]: event.target.value });
  };

  return (
    <div className="product-filters">
      <div className="product-filters__row">
        <input
          className="product-filters__input"
          type="text"
          placeholder="Search by Product Name"
          value={filters.search}
          onChange={handleChange("search")}
        />
        <select
          className="product-filters__select"
          value={filters.category}
          onChange={handleChange("category")}
        >
          <option value="">Category (All)</option>
          <option value="Men">Men</option>
          <option value="Sports">Sports</option>
          <option value="Skin Care">Skin Care</option>
          <option value="Accessories">Accessories</option>
        </select>
        <select
          className="product-filters__select"
          value={filters.price}
          onChange={handleChange("price")}
        >
          <option value="">Price (All)</option>
          <option value="below-200k">Below Rp 200K</option>
          <option value="200-500k">Rp 200K - Rp 500K</option>
          <option value="above-500k">Above Rp 500K</option>
        </select>
        <select
          className="product-filters__select"
          value={filters.stockStatus}
          onChange={handleChange("stockStatus")}
        >
          <option value="">Stock Status (All)</option>
          <option value="selling">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="soldout">Out of Stock</option>
        </select>
        <button className="product-filters__btn product-filters__btn--ghost">
          Download All Products
        </button>
      </div>
      <div className="product-filters__row">
        <button className="product-filters__btn">Filter</button>
        <button
          className="product-filters__btn product-filters__btn--ghost"
          type="button"
          onClick={() => onReset?.()}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

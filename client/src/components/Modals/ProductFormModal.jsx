import { useEffect, useState } from "react";

export default function ProductFormModal({
  open,
  onSave,
  onCancel,
  initialData,
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialData?.name || "");
      setPrice(
        typeof initialData?.price === "number" ? String(initialData.price) : ""
      );
      setStock(
        typeof initialData?.stock === "number" ? String(initialData.stock) : ""
      );
      setCategory(initialData?.category || "");
      setDescription(initialData?.description || "");
      setError("");
    }
  }, [open, initialData]);

  if (!open) {
    return null;
  }

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Price must be a valid number.");
      return;
    }
    const numericStock = stock === "" ? 0 : Number(stock);
    if (!Number.isFinite(numericStock) || numericStock < 0) {
      setError("Stock must be a valid number.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave?.({
        name: name.trim(),
        price: numericPrice,
        stock: numericStock,
        category: category.trim(),
        description: description.trim(),
      });
      setName("");
      setPrice("");
      setStock("");
      setCategory("");
      setDescription("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
    >
      <form
        onSubmit={handleSave}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          width: 360,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <h3 style={{ margin: "0 0 12px" }}>
          {initialData ? "Edit Product" : "Add Product"}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 14 }}>
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 14 }}>
            Price
            <input
              type="number"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={isSubmitting}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 14 }}>
            Stock
            <input
              type="number"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              disabled={isSubmitting}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 14 }}>
            Category
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={isSubmitting}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 14 }}>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: 8,
                marginTop: 4,
                minHeight: 72,
              }}
            />
          </label>
          {error && <div style={{ color: "crimson" }}>{error}</div>}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{ cursor: isSubmitting ? "not-allowed" : "pointer" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ cursor: isSubmitting ? "not-allowed" : "pointer" }}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProductTableSkeleton() {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ marginBottom: 12, color: "#6b7280" }}>Loading...</div>
      <div style={{ display: "grid", gap: 10 }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            style={{
              height: 36,
              background: "#f3f4f6",
              borderRadius: 8,
            }}
          />
        ))}
      </div>
    </div>
  );
}

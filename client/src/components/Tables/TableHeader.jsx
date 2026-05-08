export default function TableHeader({ columns }) {
  return (
    <thead>
      <tr>
        {columns.map((col) => (
          <th key={col.key} style={{ textAlign: col.align || "left" }}>
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

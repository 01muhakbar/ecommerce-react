export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of your store activity.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenue", value: "Rp 0" },
          { label: "Orders", value: "0" },
          { label: "Products", value: "0" },
          { label: "Customers", value: "0" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase text-slate-400">{card.label}</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
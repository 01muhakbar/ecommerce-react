import { useBestSelling } from "@/hooks/admin/useBestSelling";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#f97316", "#06b6d4", "#8b5cf6"];
const Sk = () => (
  <div className="h-64 rounded-xl bg-slate-200/70 animate-pulse" />
);

export function BestSellingCard({ limit = 5 }: { limit?: number }) {
  const { data, isLoading, error } = useBestSelling(limit);

  if (isLoading) return <Sk />;
  if (error)
    return (
      <div className="p-6 text-red-500">
        Error loading best selling products.
      </div>
    );

  const items = data ?? [];
  const total = items.reduce((a, b: any) => a + Number(b?.sales ?? 0), 0);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm relative">
      <h3 className="text-lg font-semibold mb-3">Best Selling Products 🛒</h3>

      {items.length === 0 ? (
        <div className="p-6 text-slate-500 flex flex-col items-center justify-center text-center h-64">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-12 h-12 text-slate-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l1.823-6.823a.75.75 0 0 0-.11-.649l-2.25-2.25a.75.75 0 0 0-.531-.22h-9.536a.75.75 0 0 0-.531.22L2.343 7.75a.75.75 0 0 0-.11.649l1.823 6.823Z"
            />
          </svg>
          <p className="mt-4">No best selling products yet.</p>
        </div>
      ) : (
        <>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  dataKey="sales"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  label={({ name, percent }) =>
                    `${name} ${Math.round(Number(percent ?? 0) * 100)}%`
                  }
                >
                  {items.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, _n: string, entry: any) => [
                    `${v} sold (${Math.round(
                      (Number(v) / Math.max(total, 1)) * 100
                    )}%)`,
                    entry?.payload?.name,
                  ]}
                />
                <Legend verticalAlign="middle" align="right" layout="vertical" />
              </PieChart>
            </ResponsiveContainer>

            {/* total di tengah */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xs text-slate-500">Total Sold</div>
                <div className="text-lg font-semibold">{total}</div>
              </div>
            </div>
          </div>

          {/* small list with thumbnails */}
          <ul className="mt-4 space-y-2">
            {items.map((it: any, idx: number) => (
              <li key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {it.mainImageUrl ? (
                    <img
                      src={it.mainImageUrl}
                      alt={it.name}
                      className="h-8 w-8 rounded object-cover border"
                      onError={(e: any) => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-slate-200 border" />
                  )}
                  <span className="truncate" title={it.name}>{it.name}</span>
                </div>
                <span className="text-sm text-slate-600">{Number(it.sales) || 0}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { useWeeklySales } from "@/hooks/admin/useWeeklySales";
import { formatIDR } from "@/utils/currency";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const Sk = () => (
  <div className="h-64 rounded-xl bg-slate-200/70 animate-pulse" />
);

export function WeeklySalesCard({ defaultDays = 7 }: { defaultDays?: number }) {
  const [range, setRange] = useState<7 | 14 | 30>(defaultDays as 7);
  const [mode, setMode] = useState<"sales" | "orders">("sales");
  const { data, isLoading: _isLoading, error } = useWeeklySales(range);
  const loading = Boolean(_isLoading);

  // Transform data for recharts
  const chartData = data.sales.map((sale, index) => ({
    name: `Day ${index + 1}`,
    sales: sale,
    orders: data.orders[index] || 0,
  }));

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Weekly Sales 📈</h3>
        <div className="inline-flex rounded-full border border-slate-200 p-1">
          {[7, 14, 30].map((v) => (
            <button
              key={v}
              onClick={() => setRange(v as any)}
              className={`px-3 py-1 text-sm rounded-full ${
                range === v
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
              aria-label={`Tampilkan ${v} hari`}
            >
              {v}d
            </button>
          ))}
        </div>
      </div>

      {/* Tab Sales / Orders */}
      <div className="mb-2 flex gap-3 text-sm">
        {["sales", "orders"].map((t) => (
          <button
            key={t}
            className={`underline-offset-4 ${
              mode === t ? "underline text-emerald-600" : "text-slate-500"
            }`}
            onClick={() => setMode(t as any)}
            aria-label={`Tampilkan ${t}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <Sk /> : null}
      {Boolean(error) && (
        <div className="p-6 text-red-600">Error loading sales data.</div>
      )}
      {!loading && !error && chartData.length === 0 && (
        <div className="p-6 text-slate-500 text-center">
          Belum ada penjualan minggu ini.{" "}
          <a
            href="/admin/orders/create"
            className="text-emerald-600 underline cursor-pointer"
          >
            Buat order
          </a>
        </div>
      )}
      {!loading && !error && chartData.length > 0 && (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis
                width={80}
                tickFormatter={(v) =>
                  mode === "sales" ? formatIDR(v).replace("Rp", "Rp") : v
                }
              />
              <Tooltip
                formatter={(v: any) =>
                  mode === "sales" ? formatIDR(v) : `${v} order`
                }
                labelFormatter={(l) => `Tanggal: ${l}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey={mode}
                strokeWidth={2}
                dot={false}
                name={mode === "sales" ? "Penjualan (Rp)" : "Jumlah Order"}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

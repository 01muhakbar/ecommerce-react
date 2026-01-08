import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

export default function SalesChart({ data }: { data: Array<{ x: string; y: number }> }) {
  return (
    <div className="h-60 sm:h-72 lg:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="y" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
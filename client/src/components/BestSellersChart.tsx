import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ProductSalesData {
  name: string;
  sales: number;
}

interface BestSellersChartProps {
  data: ProductSalesData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

const BestSellersChart: React.FC<BestSellersChartProps> = ({ data }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md h-80">
      <h3 className="text-lg font-semibold mb-4">Produk Terlaris</h3>
      <ResponsiveContainer width="100%" height="80%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="sales"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BestSellersChart;

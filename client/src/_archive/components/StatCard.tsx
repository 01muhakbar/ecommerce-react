import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string; // Tailwind color class, e.g., 'bg-blue-500'
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className={`p-4 rounded-lg shadow-md flex items-center justify-between text-white ${color}`}>
      <div>
        <p className="text-sm font-medium opacity-80">{title}</p>
        <h3 className="text-2xl font-bold mt-1">{value}</h3>
      </div>
      <div className="text-4xl opacity-70">
        {icon}
      </div>
    </div>
  );
};

export default StatCard;

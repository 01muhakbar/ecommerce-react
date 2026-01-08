import React from "react";
export default function Badge({ children, tone="gray" }:{children:React.ReactNode; tone?: "green"|"red"|"gray"}) {
  const map = { green: "bg-emerald-100 text-emerald-700", red: "bg-red-100 text-red-700", gray: "bg-gray-100 text-gray-700" };
  return <span className={`px-2 py-0.5 text-xs rounded ${map[tone]}`}>{children}</span>;
}
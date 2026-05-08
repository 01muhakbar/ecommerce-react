// Dashboard data contracts (ready to swap with API payloads later)
// statCards: high-level KPI tiles
// orderStatusStats: order status summary cards
export const statCards = [
  { id: "today", label: "Today Orders", value: 0, variant: "teal" },
  { id: "yesterday", label: "Yesterday Orders", value: 0, variant: "orange" },
  { id: "this-month", label: "This Month", value: 0, variant: "blue" },
  { id: "last-month", label: "Last Month", value: 0, variant: "teal-light" },
  { id: "all-time", label: "All-Time Sales", value: 0, variant: "green" },
];

export const orderStatusStats = [
  { id: "total", label: "Total Order", count: 0, variant: "default" },
  { id: "pending", label: "Orders Pending", count: 0, variant: "warning" },
  { id: "processing", label: "Orders Processing", count: 0, variant: "info" },
  { id: "completed", label: "Orders Delivered", count: 0, variant: "success" },
];

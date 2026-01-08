// Dashboard data contracts (ready to swap with API payloads later)
// statCards: high-level KPI tiles
// orderStatusStats: order status summary cards
export const statCards = [
  { id: "today", label: "Today Orders", value: 128, variant: "blue", subtitle: "vs yesterday" },
  { id: "yesterday", label: "Yesterday Orders", value: 114, variant: "purple" },
  { id: "this-month", label: "This Month", value: 3240, variant: "green", subtitle: "MTD" },
  { id: "last-month", label: "Last Month", value: 3050, variant: "orange" },
  { id: "all-time", label: "All-Time Sales", value: 1200000000, variant: "dark", subtitle: "Since launch" },
];

export const orderStatusStats = [
  { id: "total", label: "Total Orders", count: 8142, variant: "default" },
  { id: "pending", label: "Pending", count: 328, variant: "warning" },
  { id: "processing", label: "Processing", count: 512, variant: "info" },
  { id: "delivered", label: "Delivered", count: 7214, variant: "success" },
];

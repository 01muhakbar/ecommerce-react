
export interface Order {
  id: number;
  invoiceNo: string;
  customerName: string;
  orderTime: string;
  amount: number;
  status: "Pending" | "Processing" | "Delivered" | "Cancelled";
}

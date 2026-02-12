import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { fetchStoreOrder } from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";
import { getOrderStatusLabel } from "../../utils/orderStatus.js";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const getItemName = (item) =>
  item?.product?.name || item?.name || item?.title || "Item";

const getItemQuantity = (item) => Number(item?.quantity ?? item?.qty ?? item?.amount ?? 0);

const getItemPrice = (item) =>
  Number(item?.price ?? item?.unitPrice ?? item?.product?.price ?? 0);

export default function StoreOrderTrackingPage() {
  const { ref } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!ref) {
        setError("Invalid order reference.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const response = await fetchStoreOrder(ref);
        if (!active) return;
        const payload =
          response?.data?.data ??
          response?.data ??
          response?.order ??
          response?.data?.order ??
          response;
        setOrder(payload || null);
      } catch (err) {
        if (!active) return;
        const status = err?.response?.status;
        setError(status === 404 ? "Order not found." : "Failed to load order.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [ref]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading order...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
          {error}
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Order not found.
        </div>
      </section>
    );
  }

  const invoiceRef = order.invoiceNo || order.orderId || order.ref || ref;
  const createdAt = order.createdAt || order.created_at || order.orderTime || null;
  const customer = order.customer || order.user || {};
  const customerName =
    order.customerName || customer.name || order.userName || customer.email || "Customer";
  const customerEmail = order.customerEmail || customer.email || order.email || "-";
  const customerPhone = order.customerPhone || customer.phone || order.phone || "-";
  const customerAddress =
    order.customerAddress || customer.address || order.shippingAddress || "-";
  const paymentMethod = order.paymentMethod || order.method || "-";
  const items = order.items || order.orderItems || order.products || [];
  const shippingCost =
    order.shippingCost ?? order.shipping?.cost ?? order.deliveryFee ?? 0;
  const discount =
    order.discount ?? order.discountAmount ?? order.discountTotal ?? 0;
  const totalAmount =
    order.totalAmount ?? order.total ?? order.grandTotal ?? 0;
  const statusLabel = getOrderStatusLabel(order.status);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <div className="no-print mb-8 rounded-lg bg-emerald-100 px-6 py-4 text-emerald-900">
        Thank You{" "}
        <span className="font-semibold text-emerald-700">{customerName}</span>,
        Your order have been received !
      </div>

      <div className="print-area overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="bg-slate-100/60 px-8 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-wide text-slate-900">
                INVOICE
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Status : <span className="font-medium text-slate-900">{statusLabel}</span>
              </p>
            </div>
            <div className="text-right text-sm text-slate-600">
              <div className="text-lg font-bold text-emerald-600">KACHA BAZAR</div>
              <div>59 Station Rd, Purls Bridge,</div>
              <div>United Kingdom</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date
              </p>
              <p className="mt-2 text-sm text-slate-900">{formatDate(createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invoice No.
              </p>
              <p className="mt-2 text-sm text-slate-900">#{invoiceRef}</p>
            </div>
            <div className="md:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invoice To
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {customerName}
              </p>
              <p className="text-sm text-slate-600">{customerEmail}</p>
              <p className="text-sm text-slate-600">{customerPhone}</p>
              <p className="text-sm text-slate-600">{customerAddress}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">SR.</th>
                  <th className="px-4 py-3 text-left font-semibold">PRODUCT NAME</th>
                  <th className="px-4 py-3 text-right font-semibold">QUANTITY</th>
                  <th className="px-4 py-3 text-right font-semibold">ITEM PRICE</th>
                  <th className="px-4 py-3 text-right font-semibold">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item, index) => {
                    const quantity = getItemQuantity(item);
                    const price = getItemPrice(item);
                    const lineTotal = Number(item?.lineTotal ?? item?.total ?? price * quantity);
                    return (
                      <tr
                        key={`${item?.id ?? item?.productId ?? index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 text-slate-700">{index + 1}</td>
                        <td className="px-4 py-3 text-slate-700">{getItemName(item)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{quantity}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(price)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(lineTotal)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-emerald-50 px-8 py-10">
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Payment Method
              </p>
              <p className="mt-2 text-sm text-slate-900">{paymentMethod}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Shipping Cost
              </p>
              <p className="mt-2 text-sm text-slate-900">
                {formatCurrency(Number(shippingCost || 0))}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Discount
              </p>
              <p className="mt-2 text-sm text-slate-900">
                {formatCurrency(Number(discount || 0))}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Total Amount
              </p>
              <p className="mt-3 text-4xl font-extrabold text-red-500">
                {formatCurrency(Number(totalAmount || 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center justify-between gap-4 px-8 py-6">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" />
            Print Invoice
          </button>
        </div>
      </div>
    </section>
  );
}

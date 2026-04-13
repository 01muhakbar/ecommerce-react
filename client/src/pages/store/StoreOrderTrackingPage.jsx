import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { fetchStoreOrder } from "../../api/public/storeOrders.ts";
import {
  getStoreCustomization,
  getStoreSettings,
} from "../../api/public/storeCustomizationPublic.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/primitives/state/index.js";
import {
  GENERIC_ERROR,
  ORDER_NOT_FOUND,
  UPDATING,
} from "../../constants/uiMessages.js";
import {
  isPublicOrderReference,
  resolvePublicOrderReference,
} from "../../utils/publicOrderReference.js";
import { normalizeDashboardSettingCopy } from "../../utils/dashboardSettingCopy.js";
import {
  getEnabledOrderContractAction,
  getOrderContractSummary,
  isOrderContractFinal,
} from "../../utils/orderContract.ts";
import { getOrderTruthStatus } from "../../utils/orderTruth.js";
import {
  getGroupedPaymentReadModel,
  isGroupedPaymentFinal,
} from "../../utils/groupedPaymentReadModel.ts";
import { ENABLE_MULTISTORE_SHIPMENT_MVP } from "../../config/featureFlags.js";
import { normalizeShipmentList } from "../../utils/shipmentReadModel.ts";
import { getBuyerShipmentPresentation } from "../../utils/buyerShipmentPresentation.js";
import {
  getSplitOperationalBridge,
  getSplitOperationalPayment,
  getSplitOperationalShipment,
  getSplitOperationalStatusSummary,
  isSplitOperationallyFinal,
} from "../../utils/splitOperationalTruth.ts";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

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

const getItemImage = (item) =>
  resolveAssetUrl(
    item?.imageUrl ??
      item?.image ??
      item?.product?.imageUrl ??
      item?.product?.image ??
      item?.product?.promoImagePath ??
      (Array.isArray(item?.imageUrls) ? item.imageUrls[0] : null) ??
      (Array.isArray(item?.product?.imagePaths) ? item.product.imagePaths[0] : null) ??
      null
  );

const getInitials = (value, fallback = "TP") => {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return fallback;
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};

const maskWord = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= 1) return "*";
  return normalized[0] + "*".repeat(Math.min(Math.max(normalized.length - 1, 1), 4));
};

const maskName = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized
    .split(" ")
    .filter(Boolean)
    .map(maskWord)
    .join(" ");
};

const maskEmail = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized || !normalized.includes("@")) return null;
  const [localPart, ...domainParts] = normalized.split("@");
  const domain = domainParts.join("@").trim();
  if (!localPart || !domain) return null;
  return `${localPart.slice(0, 1)}${"*".repeat(Math.min(Math.max(localPart.length - 1, 3), 6))}@${domain}`;
};

const maskPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 4) return `${digits[0] || "*"}***`;
  const start = digits.slice(0, Math.min(2, digits.length));
  const end = digits.slice(-2);
  return `${start}${"*".repeat(Math.max(digits.length - start.length - end.length, 4))}${end}`;
};

const maskAddress = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return null;
  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const [first, ...rest] = parts;
  const maskedFirst = first
    .split(" ")
    .filter(Boolean)
    .map((part) => (/^\d+[A-Z0-9-]*$/i.test(part) ? "*".repeat(Math.max(part.length, 2)) : maskWord(part)))
    .join(" ");
  return [maskedFirst, ...rest].filter(Boolean).join(", ");
};

const getToneBadgeClass = (tone) => {
  const value = String(tone || "").trim().toLowerCase();
  if (value === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "sky") return "border-sky-200 bg-sky-50 text-sky-700";
  if (value === "indigo") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (value === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "rose") return "border-rose-200 bg-rose-50 text-rose-700";
  if (value === "orange") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
};

const normalizeLabel = (value, fallback = "") => {
  const label = String(value || "").trim();
  if (label) return label;
  return String(fallback || "").trim();
};

const getSplitPresentation = (split) => {
  const summary = getSplitOperationalStatusSummary(split);
  const shipment = getSplitOperationalShipment(split);
  const payment = getSplitOperationalPayment(split);
  const bridge = getSplitOperationalBridge(split);
  const buyerShipment = getBuyerShipmentPresentation(shipment?.status, shipment?.statusMeta);
  const summaryUsesShipmentLane =
    String(summary?.lane || "").trim().toUpperCase() === "SHIPMENT";

  return {
    summaryLabel: normalizeLabel(
      summaryUsesShipmentLane ? buyerShipment.label : summary?.label,
      "Awaiting update"
    ),
    summaryDescription: normalizeLabel(
      summaryUsesShipmentLane ? buyerShipment.description : summary?.description,
      bridge?.shipmentBlockedReason || "Latest seller split status."
    ),
    summaryTone: summary?.tone || "slate",
    fulfillmentLabel: normalizeLabel(
      buyerShipment.label,
      shipment?.status || String(split?.fulfillmentStatus || "UNFULFILLED")
    ),
    fulfillmentTone: buyerShipment.tone || "slate",
    paymentLabel: normalizeLabel(payment?.statusMeta?.label, payment?.status || "UNPAID"),
    paymentTone: payment?.statusMeta?.tone || "slate",
  };
};

const summarizeBuyerSplitTruth = (storeSplits) => {
  const summary = {
    awaitingPaymentCount: 0,
    underReviewCount: 0,
    shipmentLaneCount: 0,
    finalNegativeCount: 0,
  };

  (Array.isArray(storeSplits) ? storeSplits : []).forEach((split) => {
    const splitSummary = getSplitOperationalStatusSummary(split);
    const code = String(splitSummary?.code || "").trim().toUpperCase();
    const lane = String(splitSummary?.lane || "").trim().toUpperCase();
    if (code === "AWAITING_PAYMENT") {
      summary.awaitingPaymentCount += 1;
      return;
    }
    if (code === "UNDER_REVIEW") {
      summary.underReviewCount += 1;
      return;
    }
    if (Boolean(splitSummary?.isFinal) && ["FAILED", "EXPIRED", "CANCELLED", "RETURNED", "FAILED_DELIVERY"].includes(code)) {
      summary.finalNegativeCount += 1;
      return;
    }
    if (lane === "SHIPMENT") {
      summary.shipmentLaneCount += 1;
    }
  });

  return summary;
};

const normalizeTrackingPayload = (response) =>
  response?.data?.data ??
  response?.data ??
  response?.order ??
  response?.data?.order ??
  response ??
  null;

const shouldPollTrackingOrder = (order) => {
  if (!order || typeof order !== "object") return false;
  if (!isOrderContractFinal(order?.contract)) return true;

  const storeSplits = Array.isArray(order?.storeSplits) ? order.storeSplits : [];
  return storeSplits.some((split) => !isSplitOperationallyFinal(split));
};

const TRACKING_STEPS = [
  { key: "pending", label: "Order received" },
  { key: "processing", label: "Processing" },
  { key: "shipping", label: "On delivery" },
  { key: "delivered", label: "Delivered" },
];

const STOPPED_TRACKING_CODES = new Set(["CANCELLED", "FAILED", "EXPIRED"]);
const DELIVERED_TRACKING_CODES = new Set(["DELIVERED", "FINAL", "COMPLETE"]);
const SHIPPING_TRACKING_CODES = new Set(["IN_DELIVERY", "SHIPPING", "SHIPPED"]);
const PROCESSING_TRACKING_CODES = new Set([
  "READY",
  "READY_TO_FULFILL",
  "PACKED",
  "PROCESSING",
  "IN_PROGRESS",
]);
const PENDING_TRACKING_CODES = new Set([
  "PENDING",
  "ACTION_REQUIRED",
  "UNDER_REVIEW",
  "AWAITING_PAYMENT",
  "BLOCKED_BY_PAYMENT",
]);

const getTrackingPresentation = (order) => {
  const truthStatus = getOrderTruthStatus(order);
  const code = String(truthStatus.code || "").trim().toUpperCase();
  const truthDescription = String(truthStatus.summary?.description || "").trim();

  if (code === "ACTION_REQUIRED" || code === "AWAITING_PAYMENT" || code === "BLOCKED_BY_PAYMENT") {
    return {
      stepIndex: 0,
      title: "Complete payment to continue this order",
      description: truthDescription,
      isStopped: false,
      stoppedTitle: "",
      stoppedDescription: "",
    };
  }
  if (code === "UNDER_REVIEW") {
    return {
      stepIndex: 0,
      title: "Payment is under review",
      description: truthDescription,
      isStopped: false,
      stoppedTitle: "",
      stoppedDescription: "",
    };
  }
  if (code === "FAILED") {
    return {
      stepIndex: 0,
      title: "This order cannot continue",
      description: truthDescription,
      isStopped: true,
      stoppedTitle: "Payment can no longer continue",
      stoppedDescription:
        "This invoice remains available, but fulfillment will not start from this payment state.",
    };
  }
  if (code === "EXPIRED") {
    return {
      stepIndex: 0,
      title: "Payment window expired",
      description: truthDescription,
      isStopped: true,
      stoppedTitle: "Payment window already closed",
      stoppedDescription:
        "This invoice remains available, but fulfillment will not start unless a new payment flow is created.",
    };
  }
  if (code === "CANCELLED") {
    return {
      stepIndex: 0,
      title: "This order was cancelled",
      description: truthDescription,
      isStopped: true,
      stoppedTitle: "Contact the store for resolution",
      stoppedDescription:
        "This invoice remains available, but the order will not move forward unless the store recreates it.",
    };
  }
  if (PROCESSING_TRACKING_CODES.has(code)) {
    return {
      stepIndex: 1,
      title: "Your order is being prepared",
      description:
        truthDescription ||
        "The store is confirming items and getting them ready for dispatch.",
      isStopped: false,
      stoppedTitle: "",
      stoppedDescription: "",
    };
  }
  if (SHIPPING_TRACKING_CODES.has(code)) {
    return {
      stepIndex: 2,
      title: "Your order is on the way",
      description:
        truthDescription ||
        "Delivery is in progress. Keep this page for the latest status and invoice reference.",
      isStopped: false,
      stoppedTitle: "",
      stoppedDescription: "",
    };
  }
  if (DELIVERED_TRACKING_CODES.has(code)) {
    return {
      stepIndex: 3,
      title: "Your order has been delivered",
      description:
        truthDescription ||
        "The order is complete. You can keep this page as your invoice and delivery record.",
      isStopped: false,
      stoppedTitle: "",
      stoppedDescription: "",
    };
  }
  if (PENDING_TRACKING_CODES.has(code) || !code) {
    return {
      stepIndex: 0,
      title: "Your order has been received",
      description:
        truthDescription ||
        "The store has your order and will confirm processing shortly.",
      isStopped: false,
      stoppedTitle: "",
      stoppedDescription: "",
    };
  }

  return {
    stepIndex: 0,
    title: "Your order has been received",
    description: truthDescription,
    isStopped: STOPPED_TRACKING_CODES.has(code),
    stoppedTitle: STOPPED_TRACKING_CODES.has(code)
      ? "This order cannot continue from the current state"
      : "",
    stoppedDescription: STOPPED_TRACKING_CODES.has(code)
      ? "Use the latest contract status above as the source of truth for the next action."
      : "",
  };
};

export default function StoreOrderTrackingPage() {
  const { ref } = useParams();
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const orderRefParam = String(ref || "").trim();
  const hasRefParam = orderRefParam.length > 0;
  const hasValidRef = isPublicOrderReference(orderRefParam);
  const dashboardSettingQuery = useQuery({
    queryKey: ["store-customization", "dashboard-setting", "en"],
    queryFn: () => getStoreCustomization({ lang: "en", include: "dashboardSetting" }),
    staleTime: 60_000,
  });
  const brandingSettingsQuery = useQuery({
    queryKey: ["store-settings", "public", "invoice-branding"],
    queryFn: getStoreSettings,
    staleTime: 60_000,
    retry: 1,
  });
  const dashboardSettingCopy = normalizeDashboardSettingCopy(
    dashboardSettingQuery.data?.customization?.dashboardSetting
  );
  const dashboardCopy = dashboardSettingCopy.dashboard;

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["store", "tracking", orderRefParam],
    queryFn: () => fetchStoreOrder(orderRefParam),
    enabled: hasValidRef,
    retry: false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const trackedOrder = normalizeTrackingPayload(query.state.data);
      return shouldPollTrackingOrder(trackedOrder) ? 15000 : false;
    },
  });

  const order = useMemo(() => normalizeTrackingPayload(data), [data]);
  const statusCode = error?.response?.status;
  const isInvalidRefInput = hasRefParam && !hasValidRef;
  const isInvalidRefResponse = hasValidRef && statusCode === 400;
  const isInitialLoading = hasValidRef && isLoading && !data;
  const isRefetching = hasValidRef && isFetching && !isInitialLoading;
  const isNotFound =
    !hasRefParam ||
    statusCode === 404 ||
    (hasValidRef && !isInitialLoading && !isError && !order);
  const isNetworkOrServerError =
    hasValidRef && isError && statusCode !== 400 && statusCode !== 404;
  const isSuccess =
    hasValidRef &&
    !isInitialLoading &&
    !isInvalidRefResponse &&
    !isNotFound &&
    !isNetworkOrServerError &&
    Boolean(order);

  const handlePrint = () => {
    document.body.classList.add("order-print-mode");
    const cleanup = () => {
      document.body.classList.remove("order-print-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1000);
  };

  const handleDownloadInvoice = async () => {
    if (isDownloadingInvoice) return;

    try {
      setDownloadError("");
      setIsDownloadingInvoice(true);

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      const lineHeight = 6.5;
      const money = (value) => formatCurrency(Number(value || 0));
      const itemRows = Array.isArray(items)
        ? items.map((item, index) => {
            const quantity = getItemQuantity(item);
            const price = getItemPrice(item);
            const lineTotal = Number(item?.lineTotal ?? item?.total ?? price * quantity);
            return {
              no: String(index + 1),
              name: getItemName(item),
              quantity: String(quantity),
              price: money(price),
              total: money(lineTotal),
            };
          })
        : [];

      let cursorY = margin;
      const ensurePageSpace = (requiredHeight = 12) => {
        if (cursorY + requiredHeight <= pageHeight - margin) return;
        pdf.addPage();
        cursorY = margin;
      };
      const writeLabelValue = (label, value, valueAlign = "left") => {
        ensurePageSpace(lineHeight + 1);
        pdf.setFont("helvetica", "bold");
        pdf.text(`${label}:`, margin, cursorY);
        pdf.setFont("helvetica", "normal");
        if (valueAlign === "right") {
          pdf.text(String(value || "-"), pageWidth - margin, cursorY, { align: "right" });
        } else {
          pdf.text(String(value || "-"), margin + 32, cursorY);
        }
        cursorY += lineHeight;
      };

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("INVOICE", margin, cursorY);
      pdf.setFontSize(11);
      pdf.text("TP PRENEURS", pageWidth - margin, cursorY, { align: "right" });
      cursorY += 8;

      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 8;

      pdf.setFont("helvetica", "normal");
      writeLabelValue("Invoice No", `#${invoiceRef || "-"}`);
      writeLabelValue("Date", formatDate(createdAt));
      writeLabelValue("Status", statusLabel);
      writeLabelValue("Payment Method", paymentMethod);

      cursorY += 2;
      pdf.setFont("helvetica", "bold");
      pdf.text("Invoice To", margin, cursorY);
      cursorY += lineHeight;
      pdf.setFont("helvetica", "normal");
      [customerName, customerEmail, customerPhone, customerAddress]
        .filter(Boolean)
        .forEach((entry) => {
          const lines = pdf.splitTextToSize(String(entry), contentWidth);
          ensurePageSpace(lines.length * lineHeight);
          pdf.text(lines, margin, cursorY);
          cursorY += lines.length * lineHeight;
        });

      cursorY += 3;
      ensurePageSpace(18);
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, cursorY - 4, contentWidth, 10, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.text("SR.", margin + 2, cursorY + 2.5);
      pdf.text("PRODUCT", margin + 18, cursorY + 2.5);
      pdf.text("QTY", pageWidth - margin - 58, cursorY + 2.5, { align: "right" });
      pdf.text("PRICE", pageWidth - margin - 30, cursorY + 2.5, { align: "right" });
      pdf.text("AMOUNT", pageWidth - margin, cursorY + 2.5, { align: "right" });
      cursorY += 12;

      pdf.setFont("helvetica", "normal");
      itemRows.forEach((row) => {
        const nameLines = pdf.splitTextToSize(row.name, 84);
        const rowHeight = Math.max(8, nameLines.length * 5 + 2);
        ensurePageSpace(rowHeight + 2);
        pdf.text(row.no, margin + 2, cursorY);
        pdf.text(nameLines, margin + 18, cursorY);
        pdf.text(row.quantity, pageWidth - margin - 58, cursorY, { align: "right" });
        pdf.text(row.price, pageWidth - margin - 30, cursorY, { align: "right" });
        pdf.text(row.total, pageWidth - margin, cursorY, { align: "right" });
        cursorY += rowHeight;
        pdf.setDrawColor(241, 245, 249);
        pdf.line(margin, cursorY - 3, pageWidth - margin, cursorY - 3);
      });

      cursorY += 6;
      writeLabelValue("Shipping", money(shippingAmount), "right");
      writeLabelValue("Discount", money(discount), "right");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      ensurePageSpace(10);
      pdf.text("Total Amount", margin, cursorY);
      pdf.text(money(totalAmount), pageWidth - margin, cursorY, { align: "right" });
      pdf.setFontSize(11);
      cursorY += 10;

      pdf.setFont("helvetica", "bold");
      pdf.text(String(dashboardCopy.invoiceMessageFirstPartValue || "Thank You"), margin, cursorY);
      cursorY += lineHeight;
      pdf.setFont("helvetica", "normal");
      const thankYouLines = pdf.splitTextToSize(
        String(dashboardCopy.invoiceMessageLastPartValue || "Your order has been received!"),
        contentWidth
      );
      pdf.text(thankYouLines, margin, cursorY);

      const fileRef = String(invoiceRef || orderRefParam || "invoice")
        .trim()
        .replace(/[^a-z0-9-_]+/gi, "-")
        .replace(/^-+|-+$/g, "");
      pdf.save(`${fileRef || "invoice"}.pdf`);
    } catch (error) {
      console.error("[store/order-tracking] failed to download invoice pdf", error);
      setDownloadError("Failed to download invoice PDF.");
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const invoiceRef = resolvePublicOrderReference(
    order?.invoiceNo,
    order?.ref,
    orderRefParam
  );
  const createdAt = order?.createdAt || order?.created_at || order?.orderTime || null;
  const customer = order?.customer && typeof order.customer === "object" ? order.customer : {};
  const customerName =
    maskName(customer.name || order?.customerName || order?.userName) ||
    maskEmail(customer.email || order?.customerEmail || order?.email) ||
    "Customer";
  const customerEmail =
    maskEmail(customer.email || order?.customerEmail || order?.email) || "-";
  const customerPhone =
    maskPhone(customer.phone || order?.customerPhone || order?.phone) || "-";
  const customerAddress =
    maskAddress(customer.address || order?.customerAddress || order?.shippingAddress) || "-";
  const paymentMethod = order?.paymentMethod || order?.method || "-";
  const contract = order?.contract || null;
  const statusSummary = getOrderContractSummary(contract);
  const paymentEntry = order?.paymentEntry || null;
  const continuePaymentAction = getEnabledOrderContractAction(contract, "CONTINUE_PAYMENT");
  const continueStripeAction = getEnabledOrderContractAction(
    contract,
    "CONTINUE_STRIPE_PAYMENT"
  );
  const stripeContinuePath =
    String(paymentMethod || "").toUpperCase() === "STRIPE" && continueStripeAction
      ? continueStripeAction.targetPath ||
        (invoiceRef
          ? `/checkout/success?ref=${encodeURIComponent(invoiceRef)}&method=STRIPE&cancelled=1`
          : null)
      : null;
  const continuePaymentPath =
    !stripeContinuePath &&
    (paymentEntry?.visible && paymentEntry?.targetPath
      ? paymentEntry.targetPath
      : continuePaymentAction?.targetPath || null);
  const continuePaymentLabel =
    paymentEntry?.label || continuePaymentAction?.label || "Continue Payment";
  const items = order?.items || order?.orderItems || order?.products || [];
  const storeSplits = Array.isArray(order?.storeSplits) ? order.storeSplits : [];
  const shipments = normalizeShipmentList(order?.shipments);
  const splitTruthSummary = summarizeBuyerSplitTruth(storeSplits);
  const brandingSettings = brandingSettingsQuery.data?.data?.storeSettings?.branding ?? {};
  const platformBrandName =
    String(brandingSettings?.workspaceBrandName || "").trim() || "TP PRENEURS";
  const platformLogoUrl = resolveAssetUrl(brandingSettings?.clientLogoUrl || "");
  const sellerLogoEntries = Array.from(
    new Map(
      storeSplits
        .map((split) => {
          const storeId = Number(split?.storeId || 0);
          if (!storeId) return null;
          return [
            storeId,
            {
              storeId,
              storeName: String(split?.storeName || `Store #${storeId}`).trim(),
              storeLogoUrl: resolveAssetUrl(split?.storeLogoUrl || ""),
            },
          ];
        })
        .filter(Boolean)
    ).values()
  );
  const shippingAmount =
    order?.shipping ?? order?.shippingAmount ?? order?.deliveryFee ?? 0;
  const discount = order?.discount ?? order?.discountAmount ?? order?.discountTotal ?? 0;
  const totalAmount = order?.totalAmount ?? order?.total ?? order?.grandTotal ?? 0;
  const truthStatus = getOrderTruthStatus(order);
  const trackingPresentation = getTrackingPresentation(order);
  const statusLabel = truthStatus.label;
  const trackingStepIndex = trackingPresentation.stepIndex;
  const trackingSummary = {
    title: trackingPresentation.title,
    description: trackingPresentation.description,
  };
  const isTrackingStopped = trackingPresentation.isStopped;
  const nextStepTitle = isTrackingStopped
    ? trackingPresentation.stoppedTitle
    : stripeContinuePath
      ? continueStripeAction?.label || "Continue Stripe Payment"
      : continuePaymentPath
        ? continuePaymentLabel
        : truthStatus.code === "UNDER_REVIEW"
          ? "Wait for backend review"
          : "Keep this page for updates";
  const nextStepDescription = isTrackingStopped
    ? trackingPresentation.stoppedDescription
    : stripeContinuePath
      ? continueStripeAction?.description ||
        statusSummary?.description ||
        "Stripe payment can continue only through the backend-approved next step."
      : continuePaymentPath
        ? splitTruthSummary.awaitingPaymentCount > 0
          ? `Complete payment from your account for ${splitTruthSummary.awaitingPaymentCount} store split${splitTruthSummary.awaitingPaymentCount === 1 ? "" : "s"}. Shipment stays blocked per split until payment truth is settled.`
          : paymentEntry?.summaryLabel ||
            continuePaymentAction?.description ||
            trackingSummary.description
        : truthStatus.code === "UNDER_REVIEW"
          ? splitTruthSummary.underReviewCount > 0
            ? `${splitTruthSummary.underReviewCount} store split payment${splitTruthSummary.underReviewCount === 1 ? " is" : "s are"} under review. Shipment will stay blocked for those splits until backend review finishes.`
            : trackingSummary.description ||
              "Payment review is still running. This page will update after the backend state changes."
          : "Use the order reference for support, tracking checks, or printing the invoice after delivery.";
  const errorMessage = isInvalidRefResponse
    ? "Use the public invoice reference shown after checkout or in My Orders."
    : error?.response?.data?.message || error?.message || GENERIC_ERROR;

  if (isInvalidRefInput || isInvalidRefResponse) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:p-7">
          <UiEmptyState
            className="rounded-2xl"
            title="Use Your Invoice Reference"
            description={
              hasRefParam
                ? "Tracking works only with the public invoice reference from checkout or My Orders."
                : "Enter the public invoice reference from checkout or My Orders to open tracking."
            }
            actions={
              <Link
                to="/"
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Home
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  if (isInitialLoading) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiSkeleton variant="invoice" />
      </section>
    );
  }

  if (isNotFound) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:p-7">
          <UiEmptyState
            className="rounded-2xl"
            title={ORDER_NOT_FOUND}
            description={
              orderRefParam
                ? `We could not find an order for reference: ${orderRefParam}`
                : "We could not find an order for this reference."
            }
            actions={
              <Link
                to="/"
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Home
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  if (isNetworkOrServerError) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiErrorState
          title={GENERIC_ERROR}
          message={errorMessage}
          onRetry={() => refetch()}
        />
      </section>
    );
  }

  if (!isSuccess) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title={ORDER_NOT_FOUND}
          description={
            orderRefParam
              ? `We could not find an order for reference: ${orderRefParam}`
              : "We could not find an order for this reference."
          }
          actions={
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Home
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section className="order-print-root mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6 lg:py-10">
      {isRefetching ? (
        <div className="no-print mb-4 flex justify-end">
          <UiUpdatingBadge label={UPDATING} />
        </div>
      ) : null}

      <div className="no-print mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="rounded-[30px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 px-5 py-6 text-white shadow-[0_24px_48px_rgba(5,150,105,0.25)] sm:px-6 sm:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
            Order Tracking
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-[38px]">
            {trackingSummary.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-[15px]">
            Thank you <span className="font-semibold text-white">{customerName}</span>.{" "}
            {trackingSummary.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Ref #{invoiceRef || "-"}
            </span>
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              {statusLabel}
            </span>
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              {formatDate(createdAt)}
            </span>
          </div>
        </div>

        <div
          className={`rounded-[30px] border px-5 py-6 shadow-[0_18px_34px_rgba(15,23,42,0.07)] sm:px-6 ${
            isTrackingStopped
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              isTrackingStopped ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            Next Step
          </p>
          <h2 className="mt-3 text-xl font-bold leading-tight">
            {nextStepTitle}
          </h2>
          <p
            className={`mt-3 text-sm leading-6 ${
              isTrackingStopped ? "text-rose-700" : "text-slate-500"
            }`}
          >
            {nextStepDescription}
          </p>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment Method
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">{paymentMethod}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Delivery Address
              </p>
              <p className="mt-1.5 text-sm text-slate-700">{customerAddress}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="no-print mb-6 rounded-[30px] border border-slate-200 bg-white px-4 py-5 shadow-[0_18px_34px_rgba(15,23,42,0.06)] sm:px-6 sm:py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Delivery Progress
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Track every stage of this order
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Current status: <span className="font-semibold text-slate-900">{statusLabel}</span>
          </p>
        </div>

        {isTrackingStopped ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
            {trackingPresentation.stoppedDescription}
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {TRACKING_STEPS.map((step, index) => {
              const isComplete = trackingStepIndex >= index;
              const isCurrent = trackingStepIndex === index;
              return (
                <div
                  key={step.key}
                  className={`rounded-2xl border px-4 py-4 transition ${
                    isCurrent
                      ? "border-emerald-300 bg-emerald-50"
                      : isComplete
                        ? "border-emerald-200 bg-white"
                        : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                        isComplete
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-slate-500 border border-slate-200"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Step {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{step.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ENABLE_MULTISTORE_SHIPMENT_MVP && shipments.length > 0 ? (
        <div className="no-print mb-6 rounded-[30px] border border-slate-200 bg-white px-4 py-5 shadow-[0_18px_34px_rgba(15,23,42,0.06)] sm:px-6 sm:py-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                Shipment Summary
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Shipping truth stays scoped per store shipment
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Shipments: <span className="font-semibold text-slate-900">{shipments.length}</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {order?.usedLegacyFallback
              ? "This order still mixes persisted shipment truth with legacy compatibility fallback."
              : "This tracking lane reads the same shipment truth that seller and admin use."}
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {shipments.map((shipment) => {
              const buyerShipment = getBuyerShipmentPresentation(
                shipment.shipmentStatus,
                shipment.shipmentStatusMeta
              );

              return (
                <div
                  key={shipment.shipmentId || `shipment-${shipment.suborderId || shipment.storeId || shipment.storeName}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {shipment.storeName || shipment.suborderNumber || "Shipment"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {shipment.suborderNumber || "Shipment summary"} • {formatCurrency(shipment.shippingFee || 0)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getToneBadgeClass(
                      buyerShipment.tone
                    )}`}
                  >
                    {buyerShipment.label}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <p>
                    Source:{" "}
                    <span className="font-medium text-slate-900">
                      {shipment.usedLegacyFallback ? "Legacy fallback" : "Persisted shipment"}
                    </span>
                  </p>
                  <p>
                    Tracking:{" "}
                    <span className="font-medium text-slate-900">
                      {shipment.trackingNumber || "Not assigned yet"}
                    </span>
                  </p>
                  <p>
                    Courier:{" "}
                    <span className="font-medium text-slate-900">
                      {shipment.courierService || shipment.courierCode || "Pending seller assignment"}
                    </span>
                  </p>
                  <p>
                    Items:{" "}
                    <span className="font-medium text-slate-900">
                      {shipment.shipmentItems.length}
                    </span>
                  </p>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {buyerShipment.description ||
                    shipment.latestTrackingEvent?.note ||
                    "Shipment read model is available for this store shipment."}
                </p>
                {shipment.compatibilityMatchesStorage === false ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    Shipment truth and legacy compatibility storage are out of sync.
                  </div>
                ) : null}
                {shipment.incompleteTrackingData ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Courier or tracking detail is incomplete for the current shipment stage.
                  </div>
                ) : null}
                {Array.isArray(shipment.trackingEvents) && shipment.trackingEvents.length > 0 ? (
                  <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Tracking Timeline
                    </p>
                    {shipment.trackingEvents.map((event) => (
                      <div
                        key={event.eventId || `${event.status}-${event.happenedAt || "event"}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {event.statusMeta?.label || event.status || "Update"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(event.happenedAt)}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {event.note || event.statusMeta?.description || "Shipment updated."}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {storeSplits.length > 0 ? (
        <div className="no-print mb-6 rounded-[30px] border border-slate-200 bg-white px-4 py-5 shadow-[0_18px_34px_rgba(15,23,42,0.06)] sm:px-6 sm:py-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                Store Split Status
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Parent order and seller shipment are shown separately
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Parent: <span className="font-semibold text-slate-900">{statusLabel}</span>
            </p>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {storeSplits.map((split) => {
              const splitPresentation = getSplitPresentation(split);
              return (
                <div
                  key={split.suborderId || split.suborderNumber || split.storeId || split.storeName}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{split.storeName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {split.suborderNumber || "Store split"} • {formatCurrency(split.totalAmount || 0)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getToneBadgeClass(
                        splitPresentation.summaryTone
                      )}`}
                    >
                      {splitPresentation.summaryLabel}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{splitPresentation.summaryDescription}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getToneBadgeClass(
                        splitPresentation.fulfillmentTone
                      )}`}
                    >
                      Shipment {splitPresentation.fulfillmentLabel}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getToneBadgeClass(
                        splitPresentation.paymentTone
                      )}`}
                    >
                      Payment {splitPresentation.paymentLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="print-area overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
        <div className="invoice-hero bg-slate-100/60 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="invoice-print-header flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4">
                {platformLogoUrl ? (
                  <img
                    src={platformLogoUrl}
                    alt={`${platformBrandName} client logo`}
                    className="invoice-platform-logo h-14 w-auto max-w-[180px] object-contain sm:h-16"
                  />
                ) : (
                  <div className="invoice-platform-logo flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-extrabold text-emerald-700 sm:h-16 sm:w-16">
                    {getInitials(platformBrandName)}
                  </div>
                )}
              </div>
              <h1 className="invoice-title text-3xl font-extrabold tracking-wide text-slate-900">
                INVOICE
              </h1>
              <div className="invoice-status-row mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>Status:</span>
                <span
                    className={`invoice-status-badge inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getToneBadgeClass(
                    truthStatus.tone || statusSummary?.tone
                  )}`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="invoice-ref mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order Ref</p>
                <p className="mt-1.5 inline-flex break-all rounded-full border border-slate-300 bg-white px-3 py-1 font-mono text-sm font-bold text-slate-900 sm:text-base">
                  #{invoiceRef || "-"}
                </p>
              </div>
            </div>
            <div className="invoice-seller-branding lg:max-w-sm lg:text-right">
              {sellerLogoEntries.length > 0 ? (
                <div className="invoice-seller-logo-strip inline-flex flex-wrap items-center gap-3 lg:justify-end">
                  {sellerLogoEntries.map((sellerEntry) => (
                    <div
                      key={sellerEntry.storeId}
                      className="invoice-seller-logo-box flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-20 sm:w-20"
                    >
                      {sellerEntry.storeLogoUrl ? (
                        <img
                          src={sellerEntry.storeLogoUrl}
                          alt={`${sellerEntry.storeName} logo`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-200 text-sm font-bold text-slate-600">
                          {getInitials(sellerEntry.storeName, "ST")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="invoice-meta-grid mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 md:grid-cols-3">
            <div className="invoice-meta-card rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
              <p className="mt-2 text-sm text-slate-900">{formatDate(createdAt)}</p>
            </div>
            <div className="invoice-meta-card rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice No.</p>
              <p className="mt-2 break-all text-sm text-slate-900">#{invoiceRef}</p>
            </div>
            <div className="invoice-meta-card rounded-2xl border border-slate-200 bg-white px-4 py-3 md:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice To</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{customerName}</p>
              <p className="text-sm text-slate-600">{customerEmail}</p>
              <p className="text-sm text-slate-600">{customerPhone}</p>
              <p className="text-sm text-slate-600">{customerAddress}</p>
            </div>
          </div>
        </div>

        <div className="invoice-items-section px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="invoice-items-mobile space-y-3 md:hidden">
            {items.length > 0 ? (
              items.map((item, index) => {
                const quantity = getItemQuantity(item);
                const price = getItemPrice(item);
                const lineTotal = Number(item?.lineTotal ?? item?.total ?? price * quantity);
                const image = getItemImage(item);
                return (
                  <div
                    key={`${item?.id ?? item?.productId ?? index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {image ? (
                          <img
                            src={image}
                            alt={getItemName(item)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            IMG
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{getItemName(item)}</p>
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span>Quantity</span>
                        <span className="font-medium text-slate-900">{quantity}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Item Price</span>
                        <span className="font-medium text-slate-900">{formatCurrency(price)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Amount</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(lineTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No items found.
              </div>
            )}
          </div>

          <div className="invoice-items-table hidden overflow-x-auto md:block">
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
                    const image = getItemImage(item);
                    return (
                      <tr
                        key={`${item?.id ?? item?.productId ?? index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 text-slate-700">{index + 1}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                              {image ? (
                                <img
                                  src={image}
                                  alt={getItemName(item)}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                                  IMG
                                </div>
                              )}
                            </div>
                            <span>{getItemName(item)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{quantity}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(price)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(lineTotal)}</td>
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

        <div className="invoice-summary-panel bg-emerald-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="invoice-summary-grid grid gap-6 md:grid-cols-4">
            <div className="invoice-summary-card rounded-xl border border-emerald-100 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Payment Method</p>
              <p className="mt-2 text-sm text-slate-900">{paymentMethod}</p>
            </div>
            <div className="invoice-summary-card rounded-xl border border-emerald-100 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Shipping</p>
              <p className="mt-2 text-sm text-slate-900">{formatCurrency(Number(shippingAmount || 0))}</p>
            </div>
            <div className="invoice-summary-card rounded-xl border border-emerald-100 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Discount</p>
              <p className="mt-2 text-sm text-slate-900">{formatCurrency(Number(discount || 0))}</p>
            </div>
            <div className="invoice-total-card rounded-xl border border-emerald-100 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total Amount</p>
              <p className="mt-3 text-3xl font-extrabold text-red-500 sm:text-4xl">
                {formatCurrency(Number(totalAmount || 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="no-print flex flex-col gap-3 px-4 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="max-w-2xl text-sm text-slate-600">
            <p className="font-semibold text-slate-900">
              {dashboardCopy.invoiceMessageFirstPartValue}
            </p>
            <p className="mt-1">{dashboardCopy.invoiceMessageLastPartValue}</p>
            {downloadError ? (
              <p className="mt-2 text-sm text-rose-600">{downloadError}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={isDownloadingInvoice}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400 sm:w-auto"
            aria-label={dashboardCopy.downloadButtonLabel}
          >
            <Download className="h-4 w-4" />
            {isDownloadingInvoice ? "Preparing PDF..." : dashboardCopy.downloadButtonValue}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
            aria-label={dashboardCopy.printButtonLabel}
          >
            <Printer className="h-4 w-4" />
            {dashboardCopy.printButtonValue}
          </button>
          {stripeContinuePath ? (
            <Link
              to={stripeContinuePath}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              {continueStripeAction?.label || "Continue Stripe Payment"}
            </Link>
          ) : null}
          {continuePaymentPath ? (
            <Link
              to={continuePaymentPath}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              {continuePaymentLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

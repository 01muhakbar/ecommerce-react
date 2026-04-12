const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

export const getBuyerShipmentPresentation = (status, statusMeta = null) => {
  const code = normalizeCode(status || statusMeta?.code);
  const tone = String(statusMeta?.tone || "").trim() || "slate";

  if (code === "READY_TO_FULFILL") {
    return {
      code,
      tone: tone || "sky",
      label: "Preparing for shipment",
      description:
        "Payment is confirmed and the seller is getting this package ready before packing starts.",
    };
  }

  if (code === "PACKED") {
    return {
      code,
      tone: tone || "sky",
      label: "Packed",
      description:
        "The seller has packed this package and is waiting to hand it to the courier.",
    };
  }

  if (code === "FAILED_DELIVERY") {
    return {
      code,
      tone: tone || "rose",
      label: "Delivery issue",
      description:
        "A delivery attempt failed and the seller or courier is following it up.",
    };
  }

  return {
    code,
    tone,
    label: String(statusMeta?.label || code || "-").trim() || "-",
    description:
      String(statusMeta?.description || "").trim() ||
      "Shipment status is available for this store split.",
  };
};

import { Coupon } from "../models/index.js";
import {
  getCouponTimeWindow,
  normalizeCouponScopeType,
  serializePublicCouponSnapshot,
} from "./sharedContracts/couponGovernance.js";

type OffersCouponSelectionStatus =
  | "empty"
  | "all"
  | "valid"
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "unsupported_scope";

const isPlainObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const toText = (value: unknown, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const resolvePublicOffersCouponSelection = async (activeCouponCode: string) => {
  const normalizedCode = toText(activeCouponCode, "").toUpperCase();

  if (!normalizedCode) {
    return {
      selectionStatus: "empty" as OffersCouponSelectionStatus,
      couponSnapshot: null,
    };
  }

  if (normalizedCode === "ALL") {
    return {
      selectionStatus: "all" as OffersCouponSelectionStatus,
      couponSnapshot: null,
    };
  }

  const coupon = await Coupon.findOne({
    where: { code: normalizedCode } as any,
    attributes: [
      "id",
      "code",
      "discountType",
      "amount",
      "minSpend",
      "active",
      "scopeType",
      "storeId",
      "startsAt",
      "expiresAt",
    ],
  });

  if (!coupon) {
    return {
      selectionStatus: "not_found" as OffersCouponSelectionStatus,
      couponSnapshot: null,
    };
  }

  const scopeType = normalizeCouponScopeType((coupon as any).get?.("scopeType"));
  if (scopeType !== "PLATFORM") {
    return {
      selectionStatus: "unsupported_scope" as OffersCouponSelectionStatus,
      couponSnapshot: null,
    };
  }

  if (!Boolean((coupon as any).get?.("active"))) {
    return {
      selectionStatus: "inactive" as OffersCouponSelectionStatus,
      couponSnapshot: null,
    };
  }

  const timeWindow = getCouponTimeWindow(coupon);
  if (!timeWindow.started) {
    return {
      selectionStatus: "not_started" as OffersCouponSelectionStatus,
      couponSnapshot: null,
    };
  }

  if (timeWindow.expired) {
    return {
      selectionStatus: "expired" as OffersCouponSelectionStatus,
      couponSnapshot: null,
    };
  }

  return {
    selectionStatus: "valid" as OffersCouponSelectionStatus,
    couponSnapshot: serializePublicCouponSnapshot(coupon),
  };
};

export const buildPublicOffersCustomization = async (rawOffers: unknown) => {
  const offers = isPlainObject(rawOffers) ? rawOffers : {};
  const superDiscount = isPlainObject(offers.superDiscount) ? offers.superDiscount : {};
  const activeCouponCode = toText(
    superDiscount.activeCouponCode ?? superDiscount.couponCode,
    ""
  ).toUpperCase();
  const couponSelection = await resolvePublicOffersCouponSelection(activeCouponCode);

  return {
    ...offers,
    superDiscount: {
      ...superDiscount,
      activeCouponCode,
      selectionStatus: couponSelection.selectionStatus,
      couponSnapshot: couponSelection.couponSnapshot,
    },
  };
};

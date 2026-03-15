import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, WalletCards } from "lucide-react";
import { createOrderSchema } from "@ecommerce/schemas";
import { useAuth } from "../../auth/useAuth.js";
import { useCartStore } from "../../store/cart.store.ts";
import {
  createMultiStoreCheckoutOrder,
  getStoreCustomization,
  previewCheckoutByStore,
  quoteStoreCoupon,
} from "../../api/store.service.ts";
import { getDefaultAddress } from "../../api/userAddresses.ts";
import { formatCurrency } from "../../utils/format.js";
import { GENERIC_ERROR, ORDER_FAILED } from "../../constants/uiMessages.js";
import {
  getCityOptions,
  getDistrictOptions,
  getProvinceOptions,
} from "../../utils/idRegions.ts";
import {
  buildFullName,
  formatAddressSummary,
  resolveAddressEmailAddress,
  splitFullName,
  toUserAddressPayload,
} from "../../utils/userAddress.ts";

const INPUT_CLASS =
  "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-[0_1px_1px_rgba(15,23,42,0.03)] focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";

const PAYMENT_OPTIONS = [
  {
    id: "qris",
    title: "QRIS by Store",
    hint: "Each store keeps its own active QRIS destination during split checkout.",
    Icon: WalletCards,
  },
];

const LAST_ORDER_REF_STORAGE_KEY = "store_last_order_ref";
const checkoutCustomerSchema = createOrderSchema.shape.customer;
const DEFAULT_CHECKOUT_COPY = {
  personalDetails: {
    sectionTitle: "Personal Details",
    firstNameLabel: "First Name",
    lastNameLabel: "Last Name",
    emailLabel: "Email Address",
    phoneLabel: "Phone Number",
    firstNamePlaceholder: "First Name",
    lastNamePlaceholder: "Last Name",
    emailPlaceholder: "Email Address",
    phonePlaceholder: "Phone Number",
  },
  shippingDetails: {
    sectionTitle: "Shipping Details",
    provinceLabel: "Province",
    cityLabel: "City/Regency",
    districtLabel: "Subdistrict",
    postalCodeLabel: "Postal Code",
    streetNameLabel: "Street Name",
    houseNumberLabel: "House Number",
    buildingLabel: "Building",
    otherDetailsLabel: "Other Details",
    provincePlaceholder: "Select Province",
    cityPlaceholder: "Select City/Regency",
    districtPlaceholder: "Select Subdistrict",
    postalCodePlaceholder: "Postal Code",
    streetNamePlaceholder: "Street Name",
    houseNumberPlaceholder: "House Number",
    buildingPlaceholder: "Building",
    otherDetailsPlaceholder: "Block / Unit / Reference",
    paymentMethodLabel: "Payment Method",
    paymentMethodPlaceholder: "Select a preferred payment option.",
  },
  buttons: {
    continueButtonLabel: "Back to Cart",
    confirmButtonLabel: "Place an Order",
  },
  cartItemSection: {
    sectionTitle: "Cart Item Section",
    orderSummaryLabel: "Order Summary",
    applyButtonLabel: "Apply",
    subTotalLabel: "Subtotal",
    discountLabel: "Discount",
    totalCostLabel: "TOTAL COST",
  },
};

const toCopyText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const normalizeRegionLabel = (value, fallback) => {
  const normalized = toCopyText(value, fallback);
  if (normalized === "Country") {
    return "Province";
  }
  if (
    normalized === "City / Kabupaten/Kota" ||
    normalized === "City / Regency" ||
    normalized === "City"
  ) {
    return "City/Regency";
  }
  if (normalized === "District / Kecamatan" || normalized === "District") {
    return "Subdistrict";
  }
  return normalized;
};

const normalizeRegionPlaceholder = (value, fallback) => {
  const normalized = toCopyText(value, fallback);
  if (normalized === "Country" || normalized === "Select Country") {
    return "Select Province";
  }
  if (
    normalized === "Select City / Kabupaten/Kota" ||
    normalized === "Select City / Regency" ||
    normalized === "Select City"
  ) {
    return "Select City/Regency";
  }
  if (normalized === "Select District / Kecamatan" || normalized === "Select District") {
    return "Select Subdistrict";
  }
  return normalized;
};

const normalizeCheckoutCopy = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const personalDetails =
    source.personalDetails && typeof source.personalDetails === "object"
      ? source.personalDetails
      : {};
  const shippingDetails =
    source.shippingDetails && typeof source.shippingDetails === "object"
      ? source.shippingDetails
      : {};
  const buttons = source.buttons && typeof source.buttons === "object" ? source.buttons : {};
  const cartItemSection =
    source.cartItemSection && typeof source.cartItemSection === "object"
      ? source.cartItemSection
      : {};

  return {
    personalDetails: {
      sectionTitle: toCopyText(
        personalDetails.sectionTitle,
        DEFAULT_CHECKOUT_COPY.personalDetails.sectionTitle
      ),
      firstNameLabel: toCopyText(
        personalDetails.firstNameLabel,
        DEFAULT_CHECKOUT_COPY.personalDetails.firstNameLabel
      ),
      lastNameLabel: toCopyText(
        personalDetails.lastNameLabel,
        DEFAULT_CHECKOUT_COPY.personalDetails.lastNameLabel
      ),
      emailLabel: toCopyText(
        personalDetails.emailLabel,
        DEFAULT_CHECKOUT_COPY.personalDetails.emailLabel
      ),
      phoneLabel: toCopyText(
        personalDetails.phoneLabel,
        DEFAULT_CHECKOUT_COPY.personalDetails.phoneLabel
      ),
      firstNamePlaceholder: toCopyText(
        personalDetails.firstNamePlaceholder,
        DEFAULT_CHECKOUT_COPY.personalDetails.firstNamePlaceholder
      ),
      lastNamePlaceholder: toCopyText(
        personalDetails.lastNamePlaceholder,
        DEFAULT_CHECKOUT_COPY.personalDetails.lastNamePlaceholder
      ),
      emailPlaceholder: toCopyText(
        personalDetails.emailPlaceholder,
        DEFAULT_CHECKOUT_COPY.personalDetails.emailPlaceholder
      ),
      phonePlaceholder: toCopyText(
        personalDetails.phonePlaceholder,
        DEFAULT_CHECKOUT_COPY.personalDetails.phonePlaceholder
      ),
    },
    shippingDetails: {
      sectionTitle: toCopyText(
        shippingDetails.sectionTitle,
        DEFAULT_CHECKOUT_COPY.shippingDetails.sectionTitle
      ),
      provinceLabel: normalizeRegionLabel(
        shippingDetails.provinceLabel ?? shippingDetails.countryLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.provinceLabel
      ),
      cityLabel: normalizeRegionLabel(
        shippingDetails.cityLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.cityLabel
      ),
      districtLabel: normalizeRegionLabel(
        shippingDetails.districtLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.districtLabel
      ),
      postalCodeLabel: toCopyText(
        shippingDetails.postalCodeLabel ?? shippingDetails.zipLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.postalCodeLabel
      ),
      streetNameLabel: toCopyText(
        shippingDetails.streetNameLabel ?? shippingDetails.streetAddressLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.streetNameLabel
      ),
      houseNumberLabel: toCopyText(
        shippingDetails.houseNumberLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.houseNumberLabel
      ),
      buildingLabel: toCopyText(
        shippingDetails.buildingLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.buildingLabel
      ),
      otherDetailsLabel: toCopyText(
        shippingDetails.otherDetailsLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.otherDetailsLabel
      ),
      provincePlaceholder: normalizeRegionPlaceholder(
        shippingDetails.provincePlaceholder ?? shippingDetails.countryPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.provincePlaceholder
      ),
      cityPlaceholder: normalizeRegionPlaceholder(
        shippingDetails.cityPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.cityPlaceholder
      ),
      districtPlaceholder: normalizeRegionPlaceholder(
        shippingDetails.districtPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.districtPlaceholder
      ),
      postalCodePlaceholder: toCopyText(
        shippingDetails.postalCodePlaceholder ?? shippingDetails.zipPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.postalCodePlaceholder
      ),
      streetNamePlaceholder: toCopyText(
        shippingDetails.streetNamePlaceholder ?? shippingDetails.streetAddressPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.streetNamePlaceholder
      ),
      houseNumberPlaceholder: toCopyText(
        shippingDetails.houseNumberPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.houseNumberPlaceholder
      ),
      buildingPlaceholder: toCopyText(
        shippingDetails.buildingPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.buildingPlaceholder
      ),
      otherDetailsPlaceholder: toCopyText(
        shippingDetails.otherDetailsPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.otherDetailsPlaceholder
      ),
      paymentMethodLabel: toCopyText(
        shippingDetails.paymentMethodLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.paymentMethodLabel
      ),
      paymentMethodPlaceholder: toCopyText(
        shippingDetails.paymentMethodPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.paymentMethodPlaceholder
      ),
    },
    buttons: {
      continueButtonLabel: toCopyText(
        buttons.continueButtonLabel,
        DEFAULT_CHECKOUT_COPY.buttons.continueButtonLabel
      ),
      confirmButtonLabel:
        toCopyText(
          buttons.confirmButtonLabel,
          DEFAULT_CHECKOUT_COPY.buttons.confirmButtonLabel
        ).toLowerCase() === "confirm order"
          ? "Place an Order"
          : toCopyText(
              buttons.confirmButtonLabel,
              DEFAULT_CHECKOUT_COPY.buttons.confirmButtonLabel
            ),
    },
    cartItemSection: {
      sectionTitle: toCopyText(
        cartItemSection.sectionTitle,
        DEFAULT_CHECKOUT_COPY.cartItemSection.sectionTitle
      ),
      orderSummaryLabel: toCopyText(
        cartItemSection.orderSummaryLabel,
        DEFAULT_CHECKOUT_COPY.cartItemSection.orderSummaryLabel
      ),
      applyButtonLabel: toCopyText(
        cartItemSection.applyButtonLabel,
        DEFAULT_CHECKOUT_COPY.cartItemSection.applyButtonLabel
      ),
      subTotalLabel: toCopyText(
        cartItemSection.subTotalLabel,
        DEFAULT_CHECKOUT_COPY.cartItemSection.subTotalLabel
      ),
      discountLabel: toCopyText(
        cartItemSection.discountLabel,
        DEFAULT_CHECKOUT_COPY.cartItemSection.discountLabel
      ),
      totalCostLabel: toCopyText(
        cartItemSection.totalCostLabel,
        DEFAULT_CHECKOUT_COPY.cartItemSection.totalCostLabel
      ),
    },
  };
};

const resolveOrderPayload = (response) => {
  const candidates = [
    response?.data?.data,
    response?.data?.order,
    response?.data,
    response?.order,
    response,
  ];
  return (
    candidates.find((candidate) => candidate && typeof candidate === "object") || {}
  );
};

function SectionTitle({ number, title, hint }) {
  return (
    <div className="space-y-1">
      <div className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
        {number}
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {hint ? <p className="text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}

function fieldClass(hasError) {
  return `${INPUT_CLASS} ${
    hasError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : ""
  }`;
}

const EMPTY_CHECKOUT_SHIPPING_FORM = {
  province: "",
  city: "",
  district: "",
  postalCode: "",
  streetName: "",
  building: "",
  houseNumber: "",
  otherDetails: "",
  markAs: "HOME",
};

function resolveCouponReasonMessage(reason, minSpend) {
  switch (reason) {
    case "not_found":
      return "Coupon not found";
    case "inactive":
      return "Coupon is inactive";
    case "expired":
      return "Coupon has expired";
    case "minSpend":
      return `Minimum purchase ${formatCurrency(Number(minSpend || 0))} required`;
    default:
      return GENERIC_ERROR;
  }
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  useOutletContext();
  const { user } = useAuth() || {};
  const queryClient = useQueryClient();
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const subtotal = useCartStore((state) => state.subtotal);
  const totalQty = useCartStore((state) => state.totalQty);
  const clearCart = useCartStore((state) => state.clearCart);
  const updateQty = useCartStore((state) => state.updateQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const isRemoteSyncing = useCartStore((state) => state.isRemoteSyncing);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingForm, setShippingForm] = useState(EMPTY_CHECKOUT_SHIPPING_FORM);
  const [useDefaultShipping, setUseDefaultShipping] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [addressStatus, setAddressStatus] = useState("");
  const [paymentOptionId, setPaymentOptionId] = useState(PAYMENT_OPTIONS[0].id);
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponStatus, setCouponStatus] = useState("idle");
  const [appliedCouponMeta, setAppliedCouponMeta] = useState(null);
  const [couponBaseline, setCouponBaseline] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    province: "",
    city: "",
    district: "",
    postalCode: "",
    streetName: "",
    houseNumber: "",
  });
  const submitLockRef = useRef(false);
  const firstNameRef = useRef(null);
  const phoneRef = useRef(null);
  const provinceRef = useRef(null);
  const streetNameRef = useRef(null);
  const resolveHasAuthHint = () => {
    try {
      return (
        Boolean(localStorage.getItem("authToken")) ||
        localStorage.getItem("authSessionHint") === "true"
      );
    } catch {
      return false;
    }
  };
  const checkoutCustomizationQuery = useQuery({
    queryKey: ["store-customization", "checkout", "en"],
    queryFn: () => getStoreCustomization({ lang: "en", include: "checkout" }),
    staleTime: 60_000,
    retry: 1,
  });

  const checkoutCopy = useMemo(
    () => normalizeCheckoutCopy(checkoutCustomizationQuery.data?.customization?.checkout),
    [checkoutCustomizationQuery.data]
  );
  const paymentOptions = PAYMENT_OPTIONS;

  useEffect(() => {
    if (paymentOptions.length === 0) return;
    const hasSelected = paymentOptions.some((option) => option.id === paymentOptionId);
    if (hasSelected) return;
    setPaymentOptionId(paymentOptions[0].id);
  }, [paymentOptions, paymentOptionId]);

  useEffect(() => {
    if (!checkoutCustomizationQuery.isError) return;
    console.warn("[checkout] failed to load checkout customization; using defaults.");
  }, [checkoutCustomizationQuery.isError]);

  useEffect(() => {
    if (!user?.email) return;
    setEmail((prev) => (prev.trim() ? prev : String(user.email).trim()));
  }, [user?.email]);

  useEffect(() => {
    let mounted = true;
    const hasAuthHint = resolveHasAuthHint();
    if (!hasAuthHint) {
      return () => {
        mounted = false;
      };
    }
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!mounted) return;
        if (res.status === 401) {
          navigate("/auth/login");
        }
      } catch {
        if (mounted) {
          navigate("/auth/login");
        }
      }
    };
    checkAuth();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const hasItems = items.length > 0;
  const lockAddressFields = isSubmitting || isAddressLoading || useDefaultShipping;
  const shippingCost = 0;
  const provinceOptions = useMemo(
    () => getProvinceOptions(shippingForm.province),
    [shippingForm.province]
  );
  const cityOptions = useMemo(
    () => getCityOptions(shippingForm.province, shippingForm.city),
    [shippingForm.province, shippingForm.city]
  );
  const districtOptions = useMemo(
    () =>
      getDistrictOptions(
        shippingForm.province,
        shippingForm.city,
        shippingForm.district
      ),
    [shippingForm.province, shippingForm.city, shippingForm.district]
  );

  const summaryItems = useMemo(
    () =>
      items.map((item) => ({
        productId: Number(item.productId ?? item.id),
        name: item.name || "Product",
        qty: Math.max(1, Number(item.qty ?? 1)),
        price: Number(item.price ?? 0),
        imageUrl: item.imageUrl ?? item.image ?? null,
        stock: item.stock ?? null,
      })),
    [items]
  );
  const checkoutPreviewSignature = useMemo(
    () =>
      summaryItems
        .map((item) => `${item.productId}:${item.qty}`)
        .sort()
        .join("|"),
    [summaryItems]
  );
  const checkoutPreviewQuery = useQuery({
    queryKey: ["checkout-preview-by-store", checkoutPreviewSignature],
    queryFn: () => previewCheckoutByStore(),
    enabled: hasHydrated && hasItems && !isRemoteSyncing && resolveHasAuthHint(),
    staleTime: 10_000,
    retry: false,
  });

  const subtotalValue = Number(subtotal || 0);
  const discountValue = Number(discount || 0);
  const taxValue = 0;
  const quotedTotalValue = Number(appliedCouponMeta?.total);
  const total = Number.isFinite(quotedTotalValue)
    ? Math.max(0, quotedTotalValue)
    : Math.max(0, subtotalValue + shippingCost - discountValue);

  const fullName = buildFullName(firstName, lastName);
  const phoneValue = phone.trim();
  const paymentMethod = "QRIS";
  const normalizedShippingForm = useMemo(
    () => toUserAddressPayload({ ...shippingForm, fullName, phoneNumber: phoneValue }),
    [shippingForm, fullName, phoneValue]
  );
  const shippingAddress = formatAddressSummary(normalizedShippingForm);
  const shippingDetailsPayload = useMemo(
    () => ({
      fullName,
      phoneNumber: phoneValue,
      province: normalizedShippingForm.province,
      city: normalizedShippingForm.city,
      district: normalizedShippingForm.district,
      postalCode: normalizedShippingForm.postalCode,
      streetName: normalizedShippingForm.streetName,
      building: normalizedShippingForm.building || "",
      houseNumber: normalizedShippingForm.houseNumber,
      otherDetails: normalizedShippingForm.otherDetails || "",
      markAs: normalizedShippingForm.markAs,
    }),
    [fullName, phoneValue, normalizedShippingForm]
  );

  const payloadDraft = useMemo(
    () => ({
      customer: {
        name: fullName,
        phone: phoneValue,
        address: shippingAddress,
      },
      paymentMethod,
      items: summaryItems.map((item) => ({
        productId: item.productId,
        qty: item.qty,
      })),
      couponCode: appliedCouponMeta?.code || undefined,
      useDefaultShipping,
      shippingDetails: useDefaultShipping ? undefined : shippingDetailsPayload,
    }),
    [
      fullName,
      phoneValue,
      shippingAddress,
      paymentMethod,
      summaryItems,
      appliedCouponMeta,
      useDefaultShipping,
      shippingDetailsPayload,
    ]
  );
  const checkoutPreviewData = checkoutPreviewQuery.data?.data;
  const checkoutPreviewGroups = checkoutPreviewData?.groups ?? [];
  const checkoutPreviewInvalidItems = checkoutPreviewData?.invalidItems ?? [];
  const checkoutPreviewSummary = checkoutPreviewData?.summary ?? null;
  const checkoutMode = checkoutPreviewData?.checkoutMode ?? "SINGLE_STORE";
  const previewHasPaymentBlocker = checkoutPreviewGroups.some(
    (group) => !group.paymentAvailable
  );
  const couponBlocksSubmission = Boolean(appliedCouponMeta?.code);
  const isPreviewBlockingSubmission =
    !checkoutPreviewQuery.isError &&
    (previewHasPaymentBlocker || checkoutPreviewInvalidItems.length > 0);
  const applyAddressToCheckoutForm = (address) => {
    const normalized = toUserAddressPayload(address || {});
    const fullNameParts = splitFullName(normalized.fullName);
    const nextEmail = resolveAddressEmailAddress(address, user?.email);
    setFirstName(fullNameParts.firstName);
    setLastName(fullNameParts.lastName);
    setEmail(nextEmail);
    setPhone(normalized.phoneNumber);
    setFieldErrors((prev) => ({
      ...prev,
      firstName: "",
      lastName: "",
      phone: "",
      province: "",
      city: "",
      district: "",
      postalCode: "",
      streetName: "",
      houseNumber: "",
    }));
    setShippingForm((prev) => ({
      ...prev,
      province: normalized.province,
      city: normalized.city,
      district: normalized.district,
      postalCode: normalized.postalCode,
      streetName: normalized.streetName,
      building: normalized.building || "",
      houseNumber: normalized.houseNumber,
      otherDetails: normalized.otherDetails || "",
      markAs: normalized.markAs,
    }));
  };

  const loadDefaultAddress = async () => {
    setAddressStatus("");
    setIsAddressLoading(true);
    try {
      const defaultAddress = await getDefaultAddress();
      if (!defaultAddress) {
        setUseDefaultShipping(false);
        setAddressStatus("Default shipping address not found.");
        return null;
      }
      applyAddressToCheckoutForm(defaultAddress);
      setAddressStatus(
        "Default shipping address applied. Disable the toggle to edit manually."
      );
      return defaultAddress;
    } catch (requestError) {
      setUseDefaultShipping(false);
      setAddressStatus(
        requestError?.response?.data?.message ||
          "Failed to load default shipping address."
      );
      return null;
    } finally {
      setIsAddressLoading(false);
    }
  };

  const focusField = (ref) => {
    if (!ref?.current) return;
    ref.current.focus();
    ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const clearAppliedCoupon = (message = "", status = "idle") => {
    setDiscount(0);
    setAppliedCouponMeta(null);
    setCouponBaseline(null);
    setCouponStatus(status);
    setCouponMessage(message);
  };

  const handleApplyCoupon = async () => {
    if (couponStatus === "loading") return;

    const code = couponCode.trim().toUpperCase();
    if (!code) {
      if (appliedCouponMeta?.code) {
        setCouponCode("");
        clearAppliedCoupon("Coupon removed.", "idle");
        return;
      }
      clearAppliedCoupon("Please enter coupon code.", "error");
      return;
    }

    setCouponStatus("loading");
    setCouponMessage("");
    try {
      const quoted = await quoteStoreCoupon({
        code,
        subtotal: subtotalValue,
        shipping: shippingCost,
      });

      if (!quoted?.valid) {
        clearAppliedCoupon(
          resolveCouponReasonMessage(quoted?.reason, quoted?.minSpend),
          "error"
        );
        return;
      }

      const normalizedCode = String(quoted.code || code).trim().toUpperCase();
      const normalizedDiscount = Number(quoted.discount || 0);
      const normalizedTotal = Number(quoted.total || 0);
      setCouponCode(normalizedCode);
      setDiscount(Number.isFinite(normalizedDiscount) ? normalizedDiscount : 0);
      setAppliedCouponMeta({
        code: normalizedCode,
        discountType: quoted.discountType || "percent",
        discountValue: Number(quoted.discountValue || 0),
        minSpend: Number(quoted.minSpend || 0),
        total: Number.isFinite(normalizedTotal) ? normalizedTotal : 0,
      });
      setCouponBaseline({
        subtotal: subtotalValue,
        shipping: shippingCost,
      });
      setCouponStatus("applied");
      setCouponMessage(`Coupon ${normalizedCode} applied.`);
    } catch (err) {
      const serverMessage =
        typeof err?.response?.data?.message === "string"
          ? err.response.data.message
          : "";
      clearAppliedCoupon(serverMessage || GENERIC_ERROR, "error");
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    clearAppliedCoupon("Coupon removed.", "idle");
  };

  useEffect(() => {
    if (!appliedCouponMeta || !couponBaseline) return;
    const hasSubtotalChanged = Number(couponBaseline.subtotal) !== Number(subtotalValue);
    const hasShippingChanged = Number(couponBaseline.shipping) !== Number(shippingCost);
    if (!hasSubtotalChanged && !hasShippingChanged) return;

    clearAppliedCoupon("Cart updated. Please re-apply coupon.", "idle");
  }, [appliedCouponMeta, couponBaseline, subtotalValue, shippingCost]);

  const handleQtyDecrement = (item) => {
    const currentQty = Math.max(1, Number(item.qty ?? 1));
    if (currentQty <= 1) return;
    updateQty(item.productId, currentQty - 1);
  };

  const handleQtyIncrement = (item) => {
    const currentQty = Math.max(1, Number(item.qty ?? 1));
    const stockValue = Number(item.stock);
    const stock = Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : null;
    const nextQty = stock !== null ? Math.min(stock, currentQty + 1) : currentQty + 1;
    if (nextQty <= currentQty) return;
    updateQty(item.productId, nextQty);
  };

  const handleToggleDefaultShipping = async () => {
    if (!resolveHasAuthHint()) {
      navigate("/auth/login", { replace: true, state: { from: "/checkout" } });
      return;
    }
    if (isAddressLoading) return;
    if (useDefaultShipping) {
      setUseDefaultShipping(false);
      setAddressStatus("");
      return;
    }
    setUseDefaultShipping(true);
    await loadDefaultAddress();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitLockRef.current || isSubmitting) {
      return;
    }

    const hasAuthHint = resolveHasAuthHint();
    if (!hasAuthHint) {
      navigate("/auth/login", { replace: true, state: { from: "/checkout" } });
      return;
    }

    setError("");
    setFieldErrors({
      firstName: "",
      lastName: "",
      phone: "",
      province: "",
      city: "",
      district: "",
      postalCode: "",
      streetName: "",
      houseNumber: "",
    });

    const requiredShippingFields = {
      province: shippingForm.province.trim(),
      city: shippingForm.city.trim(),
      district: shippingForm.district.trim(),
      postalCode: shippingForm.postalCode.trim(),
      streetName: shippingForm.streetName.trim(),
      houseNumber: shippingForm.houseNumber.trim(),
    };

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !phoneValue ||
      !requiredShippingFields.province ||
      !requiredShippingFields.city ||
      !requiredShippingFields.district ||
      !requiredShippingFields.postalCode ||
      !requiredShippingFields.streetName ||
      !requiredShippingFields.houseNumber
    ) {
      setError("Please complete required checkout fields.");
      const nextErrors = {
        firstName: firstName.trim() ? "" : "First name is required.",
        lastName: lastName.trim() ? "" : "Last name is required.",
        phone: phoneValue ? "" : "Phone is required.",
        province: requiredShippingFields.province ? "" : "Province is required.",
        city: requiredShippingFields.city ? "" : "City/Regency is required.",
        district: requiredShippingFields.district ? "" : "Subdistrict is required.",
        postalCode: requiredShippingFields.postalCode ? "" : "Postal code is required.",
        streetName: requiredShippingFields.streetName ? "" : "Street name is required.",
        houseNumber: requiredShippingFields.houseNumber ? "" : "House number is required.",
      };
      setFieldErrors(nextErrors);
      if (nextErrors.firstName) {
        focusField(firstNameRef);
      } else if (nextErrors.phone) {
        focusField(phoneRef);
      } else if (nextErrors.province) {
        focusField(provinceRef);
      } else if (nextErrors.streetName) {
        focusField(streetNameRef);
      }
      return;
    }

    if (!/^\d{5}$/.test(requiredShippingFields.postalCode)) {
      setError("Postal code must be 5 digits.");
      setFieldErrors((prev) => ({
        ...prev,
        postalCode: "Postal code must be 5 digits.",
      }));
      focusField(streetNameRef);
      return;
    }

    const parsedCustomer = checkoutCustomerSchema.safeParse(payloadDraft.customer);
    if (!parsedCustomer.success) {
      const nextErrors = {
        firstName: "",
        lastName: "",
        phone: "",
        province: "",
        city: "",
        district: "",
        postalCode: "",
        streetName: "",
        houseNumber: "",
      };
      for (const issue of parsedCustomer.error.issues) {
        const path = issue.path.join(".");
        if (path === "name") {
          nextErrors.firstName = issue.message;
        }
        if (path === "phone") {
          nextErrors.phone = issue.message;
        }
        if (path === "address") {
          nextErrors.streetName = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      setError("Please check highlighted fields.");
      if (nextErrors.firstName) {
        focusField(firstNameRef);
      } else if (nextErrors.phone) {
        focusField(phoneRef);
      } else if (nextErrors.province) {
        focusField(provinceRef);
      } else if (nextErrors.streetName) {
        focusField(streetNameRef);
      }
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (couponBlocksSubmission) {
      setError(
        "Coupons are not supported in the current checkout lane yet. Remove the coupon before placing the order."
      );
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const submitPayload = {
        customer: parsedCustomer.data,
        useDefaultShipping,
        shippingDetails: useDefaultShipping ? undefined : shippingDetailsPayload,
      };
      const response = await createMultiStoreCheckoutOrder(submitPayload);
      const result = resolveOrderPayload(response);
      const resolvedOrderRef = [
        result?.invoiceNo,
        result?.ref,
        result?.invoice,
        result?.orderRef,
        result?.id,
        result?.orderId,
      ]
        .map((value) => (value == null ? "" : String(value).trim()))
        .find((value) => value.length > 0);
      if (resolvedOrderRef) {
        try {
          localStorage.setItem(LAST_ORDER_REF_STORAGE_KEY, resolvedOrderRef);
        } catch {
          // ignore storage errors
        }
      }
      clearCart();
      await queryClient.invalidateQueries({
        queryKey: ["account", "orders", "my"],
      });
      const resolvedOrderId =
        result?.orderId != null
          ? String(result.orderId)
          : result?.id != null
            ? String(result.id)
            : "";
      if (!resolvedOrderId) {
        throw new Error("Checkout completed without an order id.");
      }
      const paymentParams = new URLSearchParams();
      paymentParams.set("checkoutCreated", "true");
      if (resolvedOrderRef) {
        paymentParams.set("ref", resolvedOrderRef);
      }
      navigate(`/user/my-orders/${resolvedOrderId}/payment?${paymentParams.toString()}`);
    } catch (err) {
      const data = err?.response?.data;
      const serverMessage =
        typeof data?.message === "string" && data.message.trim()
          ? data.message.trim()
          : "";
      if (err?.response?.status === 401) {
        navigate("/auth/login", { replace: true, state: { from: "/checkout" } });
        return;
      }
      if (err?.response?.status === 409 && Array.isArray(data?.data?.invalidItems)) {
        setError(
          serverMessage ||
            "Some cart items are no longer eligible for checkout. Remove or update them, then try again."
        );
      } else if (err?.response?.status === 409 && Array.isArray(data?.data?.groups)) {
        setError(
          serverMessage ||
            "One or more stores are not ready for checkout yet. Fix the blocked store groups and try again."
        );
      } else if (err?.response?.status === 400 && Array.isArray(data?.missing)) {
        clearCart();
        setError("Cart items are no longer available. Please add them again.");
        setTimeout(() => navigate("/search"), 800);
      } else {
        setError(serverMessage || ORDER_FAILED);
      }
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!hasHydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-6 w-56 animate-pulse rounded bg-slate-200" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!hasItems) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Checkout is blocked</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your cart is empty. Please add products before checkout.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/cart"
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Cart
            </Link>
            <Link
              to="/search"
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-[1240px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6 lg:py-10">
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr] lg:gap-8">
        <div className="space-y-6">
          <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] sm:p-6 lg:p-7">
            <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
                  Secure Checkout
                </p>
                <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Checkout</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Complete your delivery details, confirm payment preference, and review the
                  final order summary before placing the order.
                </p>
                {checkoutCustomizationQuery.isLoading ? (
                  <p className="mt-2 text-xs text-slate-500">Loading checkout labels...</p>
                ) : null}
                {checkoutCustomizationQuery.isError ? (
                  <p className="mt-2 text-xs text-amber-600">
                    Using default checkout labels.
                  </p>
                ) : null}
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-3">
                <span className="text-sm font-medium text-slate-700">
                  Use Default Shipping Address
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useDefaultShipping}
                  aria-label="Use Default Shipping Address"
                  onClick={handleToggleDefaultShipping}
                  disabled={isAddressLoading}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
                    useDefaultShipping ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                >
                  <span
                    className={`absolute h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      useDefaultShipping ? "translate-x-1" : "translate-x-6"
                    }`}
                  />
                </button>
                <span
                  className={`text-xs font-semibold ${
                    useDefaultShipping ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {useDefaultShipping ? "Yes" : "No"}
                </span>
              </div>
            </div>
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                  Step 1
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Contact Details</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Add the customer name, email, and phone used for delivery updates.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Step 2
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Shipping Details</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Confirm the destination details used for delivery.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Step 3
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Review & Place</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Double-check the summary, then submit to generate the order reference.
                </p>
              </div>
            </div>

            {isAddressLoading || addressStatus ? (
              <p
                className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                  useDefaultShipping
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : "border-rose-100 bg-rose-50 text-rose-700"
                }`}
              >
                {isAddressLoading
                  ? "Loading your default shipping address..."
                  : addressStatus}
              </p>
            ) : null}

            <div className="mt-7 space-y-6">
              <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <SectionTitle
                  number="01."
                  title={checkoutCopy.personalDetails.sectionTitle}
                  hint="Enter your contact details."
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      {checkoutCopy.personalDetails.firstNameLabel} *
                    </label>
                    <input
                      ref={firstNameRef}
                      type="text"
                      value={firstName}
                      onChange={(event) => {
                        setFirstName(event.target.value);
                        if (fieldErrors.firstName) {
                          setFieldErrors((prev) => ({ ...prev, firstName: "" }));
                        }
                      }}
                      disabled={lockAddressFields}
                      placeholder={checkoutCopy.personalDetails.firstNamePlaceholder}
                      className={fieldClass(Boolean(fieldErrors.firstName))}
                    />
                    {fieldErrors.firstName ? (
                      <p className="mt-1 text-xs text-rose-600">{fieldErrors.firstName}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      {checkoutCopy.personalDetails.lastNameLabel} *
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(event) => {
                        setLastName(event.target.value);
                        if (fieldErrors.lastName) {
                          setFieldErrors((prev) => ({ ...prev, lastName: "" }));
                        }
                      }}
                      disabled={lockAddressFields}
                      placeholder={checkoutCopy.personalDetails.lastNamePlaceholder}
                      className={fieldClass(Boolean(fieldErrors.lastName))}
                    />
                    {fieldErrors.lastName ? (
                      <p className="mt-1 text-xs text-rose-600">{fieldErrors.lastName}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      {checkoutCopy.personalDetails.emailLabel}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={lockAddressFields}
                      placeholder={checkoutCopy.personalDetails.emailPlaceholder}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      {checkoutCopy.personalDetails.phoneLabel} *
                    </label>
                    <input
                      ref={phoneRef}
                      type="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        if (fieldErrors.phone) {
                          setFieldErrors((prev) => ({ ...prev, phone: "" }));
                        }
                      }}
                      disabled={lockAddressFields}
                      placeholder={checkoutCopy.personalDetails.phonePlaceholder}
                      className={fieldClass(Boolean(fieldErrors.phone))}
                    />
                    {fieldErrors.phone ? (
                      <p className="mt-1 text-xs text-rose-600">{fieldErrors.phone}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <SectionTitle
                  number="02."
                  title={checkoutCopy.shippingDetails.sectionTitle}
                  hint="Confirm the delivery destination."
                />
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.provinceLabel} *
                      </label>
                      <select
                        ref={provinceRef}
                        value={shippingForm.province}
                        onChange={(event) => {
                          const province = event.target.value;
                          setShippingForm((prev) => ({
                            ...prev,
                            province,
                            city: "",
                            district: "",
                          }));
                          if (fieldErrors.province || fieldErrors.city || fieldErrors.district) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              province: "",
                              city: "",
                              district: "",
                            }));
                          }
                        }}
                        disabled={lockAddressFields}
                        className={fieldClass(Boolean(fieldErrors.province))}
                      >
                        <option value="">
                          {checkoutCopy.shippingDetails.provincePlaceholder}
                        </option>
                        {provinceOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.province ? (
                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.province}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.cityLabel} *
                      </label>
                      <select
                        value={shippingForm.city}
                        onChange={(event) => {
                          const city = event.target.value;
                          setShippingForm((prev) => ({
                            ...prev,
                            city,
                            district: "",
                          }));
                          if (fieldErrors.city || fieldErrors.district) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              city: "",
                              district: "",
                            }));
                          }
                        }}
                        disabled={lockAddressFields || !shippingForm.province}
                        className={fieldClass(Boolean(fieldErrors.city))}
                      >
                        <option value="">
                          {shippingForm.province
                            ? checkoutCopy.shippingDetails.cityPlaceholder
                            : "Select Province first"}
                        </option>
                        {cityOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.city ? (
                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.city}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.districtLabel} *
                      </label>
                      <select
                        value={shippingForm.district}
                        onChange={(event) => {
                          setShippingForm((prev) => ({
                            ...prev,
                            district: event.target.value,
                          }));
                          if (fieldErrors.district) {
                            setFieldErrors((prev) => ({ ...prev, district: "" }));
                          }
                        }}
                        disabled={lockAddressFields || !shippingForm.city}
                        className={fieldClass(Boolean(fieldErrors.district))}
                      >
                        <option value="">
                          {shippingForm.city
                            ? checkoutCopy.shippingDetails.districtPlaceholder
                            : "Select City/Regency first"}
                        </option>
                        {districtOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.district ? (
                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.district}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.postalCodeLabel} *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={shippingForm.postalCode}
                        onChange={(event) => {
                          setShippingForm((prev) => ({
                            ...prev,
                            postalCode: event.target.value.replace(/\D/g, "").slice(0, 5),
                          }));
                          if (fieldErrors.postalCode) {
                            setFieldErrors((prev) => ({ ...prev, postalCode: "" }));
                          }
                        }}
                        disabled={lockAddressFields}
                        placeholder={checkoutCopy.shippingDetails.postalCodePlaceholder}
                        className={fieldClass(Boolean(fieldErrors.postalCode))}
                      />
                      {fieldErrors.postalCode ? (
                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.postalCode}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.streetNameLabel} *
                      </label>
                      <input
                        ref={streetNameRef}
                        type="text"
                        value={shippingForm.streetName}
                        onChange={(event) => {
                          setShippingForm((prev) => ({
                            ...prev,
                            streetName: event.target.value,
                          }));
                          if (fieldErrors.streetName) {
                            setFieldErrors((prev) => ({ ...prev, streetName: "" }));
                          }
                        }}
                        disabled={lockAddressFields}
                        placeholder={checkoutCopy.shippingDetails.streetNamePlaceholder}
                        className={fieldClass(Boolean(fieldErrors.streetName))}
                      />
                      {fieldErrors.streetName ? (
                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.streetName}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.houseNumberLabel} *
                      </label>
                      <input
                        type="text"
                        value={shippingForm.houseNumber}
                        onChange={(event) => {
                          setShippingForm((prev) => ({
                            ...prev,
                            houseNumber: event.target.value,
                          }));
                          if (fieldErrors.houseNumber) {
                            setFieldErrors((prev) => ({ ...prev, houseNumber: "" }));
                          }
                        }}
                        disabled={lockAddressFields}
                        placeholder={checkoutCopy.shippingDetails.houseNumberPlaceholder}
                        className={fieldClass(Boolean(fieldErrors.houseNumber))}
                      />
                      {fieldErrors.houseNumber ? (
                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.houseNumber}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.buildingLabel}
                      </label>
                      <input
                        type="text"
                        value={shippingForm.building}
                        onChange={(event) => {
                          setShippingForm((prev) => ({
                            ...prev,
                            building: event.target.value,
                          }));
                        }}
                        disabled={lockAddressFields}
                        placeholder={checkoutCopy.shippingDetails.buildingPlaceholder}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.otherDetailsLabel}
                      </label>
                      <textarea
                        value={shippingForm.otherDetails}
                        onChange={(event) => {
                          setShippingForm((prev) => ({
                            ...prev,
                            otherDetails: event.target.value,
                          }));
                        }}
                        disabled={lockAddressFields}
                        placeholder={checkoutCopy.shippingDetails.otherDetailsPlaceholder}
                        className={`${INPUT_CLASS} h-24 py-3`}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <SectionTitle
                  number="03."
                  title="Order Summary by Store"
                  hint={
                    checkoutMode === "MULTI_STORE"
                      ? "Your cart is grouped by store for the multi-store QRIS transition."
                      : "This cart currently resolves to a single store."
                  }
                />
                {checkoutPreviewQuery.isLoading || isRemoteSyncing ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {[0, 1].map((item) => (
                      <div
                        key={item}
                        className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                        <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />
                        <div className="h-10 animate-pulse rounded-2xl bg-slate-200" />
                      </div>
                    ))}
                  </div>
                ) : null}
                {checkoutPreviewQuery.isError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Grouped checkout preview is temporarily unavailable. Final submit will retry
                    the same multi-store validation on the server.
                  </div>
                ) : null}
                {!checkoutPreviewQuery.isLoading && !checkoutPreviewQuery.isError ? (
                  <>
                    {previewHasPaymentBlocker ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Some stores do not have an active QRIS payment profile yet. Fix store
                        payment readiness before submitting this order.
                      </div>
                    ) : null}
                    {checkoutPreviewInvalidItems.length > 0 ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {checkoutPreviewInvalidItems.length} item(s) are no longer valid for
                        checkout. Remove or update them before submitting this order.
                      </div>
                    ) : null}
                    {checkoutPreviewSummary ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Checkout Mode
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {checkoutMode === "MULTI_STORE" ? "Multi-Store" : "Single Store"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Preview Items
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {checkoutPreviewSummary.totalItems} items in{" "}
                            {checkoutPreviewGroups.length} store
                            {checkoutPreviewGroups.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Preview Total
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {formatCurrency(checkoutPreviewSummary.grandTotal)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    <div className="space-y-4">
                      {checkoutPreviewGroups.map((group) => (
                        <article
                          key={group.storeId}
                          className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-slate-900">
                                  {group.storeName}
                                </h3>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                    group.paymentAvailable
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {group.paymentAvailable ? "QRIS Ready" : "QRIS Not Ready"}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {group.storeSlug
                                  ? `/${group.storeSlug}`
                                  : `Store ID ${group.storeId}`}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                              Payment Profile:{" "}
                              <span className="font-semibold text-slate-900">
                                {group.paymentProfileStatus}
                              </span>
                            </div>
                          </div>

                          {group.warning ? (
                            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                              {group.warning}
                            </p>
                          ) : null}
                          {group.paymentInstruction ? (
                            <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                              {group.paymentInstruction}
                            </p>
                          ) : null}

                          <div className="mt-4 space-y-3">
                            {group.items.map((item) => (
                              <div
                                key={`${group.storeId}-${item.productId}`}
                                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                              >
                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                                  {item.image ? (
                                    <img
                                      src={item.image}
                                      alt={item.productName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                                      IMG
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {item.productName}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Qty {item.qty} x {formatCurrency(item.price)}
                                    {item.category?.name ? ` • ${item.category.name}` : ""}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">Line Total</p>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {formatCurrency(item.lineTotal)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Subtotal
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatCurrency(group.subtotalAmount)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Shipping
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatCurrency(group.shippingAmount)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Store Total
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatCurrency(group.totalAmount)}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </section>

              <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <SectionTitle
                  number="04."
                  title="Payment After Order Placement"
                  hint={
                    checkoutMode === "MULTI_STORE"
                      ? "This marketplace order will split payment by store. QRIS, nominal, and proof upload stay on the next payment screen after the order is created."
                      : "QRIS, nominal, deadline, and proof submission appear after the order is created."
                  }
                />
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  {paymentOptions.map((option) => {
                    const selected = paymentOptionId === option.id;
                    const Icon = option.Icon;
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                          selected
                            ? "border-emerald-300 bg-white"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentOption"
                          className="sr-only"
                          checked={selected}
                          onChange={() => setPaymentOptionId(option.id)}
                        />
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {option.title}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-600">
                            {option.hint}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  <p className="mt-3 text-xs leading-5 text-emerald-900">
                    Place the order first. After that, you will be redirected to the store-scoped
                    QRIS payment page where each store shows its own QR image, exact nominal,
                    deadline, and proof lane.
                  </p>
                </div>
                <div className="grid gap-3">
                  {checkoutPreviewGroups.map((group) => (
                    <article
                      key={`payment-${group.storeId}`}
                      className={`rounded-2xl border p-4 ${
                        group.paymentAvailable
                          ? "border-slate-200 bg-slate-50"
                          : "border-amber-200 bg-amber-50"
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {group.storeName}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                group.paymentAvailable
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {group.paymentAvailable ? "QRIS Ready" : "QRIS Blocked"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {group.storeSlug ? `/${group.storeSlug}` : `Store ID ${group.storeId}`}
                          </p>
                        </div>
                        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:text-right">
                          <p>
                            <span className="font-semibold text-slate-900">Payment type:</span>{" "}
                            {group.paymentMethod || "Unavailable"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Snapshot:</span>{" "}
                            {group.paymentProfileStatus}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Merchant:</span>{" "}
                            {group.merchantName || "-"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Account label:</span>{" "}
                            {group.accountName || "-"}
                          </p>
                        </div>
                      </div>
                          {group.warning ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs leading-5 text-amber-800">
                          {group.warning}
                        </div>
                      ) : null}
                      <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Buyer Guidance
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              {group.paymentAvailable
                                ? "QRIS details stay hidden on checkout. After Place an Order, open the payment page for this store to scan the QR code, copy the exact amount, and submit proof."
                                : "This store does not have an active approved QRIS setup yet, so the order cannot be submitted."}
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Store Total
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatCurrency(group.totalAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Deadline
                              </p>
                              <p className="mt-1 text-sm text-slate-700">
                                Payment deadline starts after the order is created.
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Proof Lane
                              </p>
                              <p className="mt-1 text-sm text-slate-700">
                                Submit proof separately for {group.storeName} after transfer.
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Instructions
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {group.paymentInstruction ||
                                "Follow the QRIS instructions on the payment page after the order is created."}
                            </p>
                          </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p>{error}</p>
                <p className="mt-1 text-xs text-rose-600">
                  Fix any issue and press {checkoutCopy.buttons.confirmButtonLabel} to try again.
                </p>
              </div>
            ) : null}

            <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:justify-between">
              <Link
                to="/cart"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:w-auto"
              >
                {checkoutCopy.buttons.continueButtonLabel}
              </Link>
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Checkout Summary
              </p>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">
                  {checkoutCopy.cartItemSection.orderSummaryLabel}
                </h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {totalQty} Items
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-500">
                Review items, coupon impact, and the final amount before you submit.
              </p>
            </div>

            <div className="mt-5 rounded-[24px] bg-slate-900 px-4 py-4 text-white shadow-[0_18px_34px_rgba(15,23,42,0.18)] sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                Estimated Total
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-extrabold leading-none sm:text-[34px]">
                    {formatCurrency(total)}
                  </p>
                  <p className="mt-2 text-xs text-slate-300">
                    Discounts and store settings are reflected live in this summary.
                  </p>
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                  Submit Next
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {summaryItems.map((item) => {
                const stockValue = Number(item.stock);
                const stock =
                  Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : null;
                const canIncrement = stock === null || item.qty < stock;
                return (
                  <div
                    key={item.productId}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            IMG
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold leading-5 text-slate-900">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Item Price {formatCurrency(item.price)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-900">
                          {formatCurrency(item.price * item.qty)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        disabled={isSubmitting || isRemoteSyncing}
                        className="rounded-full p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-1 shadow-sm">
                        <button
                          type="button"
                          disabled={item.qty <= 1 || isSubmitting || isRemoteSyncing}
                          onClick={() => handleQtyDecrement(item)}
                          className="h-7 w-7 rounded-full border border-transparent text-xs font-semibold text-slate-700 hover:border-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          -
                        </button>
                        <span className="min-w-8 text-center text-xs font-semibold text-slate-900">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          disabled={!canIncrement || isSubmitting || isRemoteSyncing}
                          onClick={() => handleQtyIncrement(item)}
                          className="h-7 w-7 rounded-full border border-transparent text-xs font-semibold text-slate-700 hover:border-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="text-xs font-semibold uppercase text-slate-600">Coupon Code</p>
              <div className="mt-2 flex items-center gap-2.5">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  disabled={isSubmitting || couponStatus === "loading"}
                  placeholder="Coupon Code"
                  className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={isSubmitting || couponStatus === "loading"}
                  className="h-11 w-24 shrink-0 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-28"
                >
                  {couponStatus === "loading"
                    ? "Applying..."
                    : checkoutCopy.cartItemSection.applyButtonLabel}
                </button>
              </div>
              {appliedCouponMeta?.code ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-emerald-600">
                    Applied: {appliedCouponMeta.code}
                  </p>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    disabled={isSubmitting || couponStatus === "loading"}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              {couponMessage ? (
                <p
                  className={`mt-2 text-xs ${
                    couponStatus === "error"
                      ? "text-rose-600"
                      : couponStatus === "applied"
                        ? "text-emerald-600"
                        : "text-slate-500"
                  }`}
                >
                  {couponMessage}
                </p>
              ) : null}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>{checkoutCopy.cartItemSection.subTotalLabel}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatCurrency(subtotalValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>{checkoutCopy.cartItemSection.discountLabel}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      discountValue > 0 ? "text-emerald-600" : "text-slate-900"
                    }`}
                  >
                    {discountValue > 0
                      ? `- ${formatCurrency(discountValue)}`
                      : formatCurrency(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tax</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatCurrency(taxValue)}
                  </span>
                </div>
              </div>
              <div className="mt-4 border-t border-dashed border-slate-200 pt-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-slate-900">
                    {checkoutCopy.cartItemSection.totalCostLabel}
                  </span>
                  <span className="text-2xl font-extrabold tabular-nums text-slate-900">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
              After placing the order, you will be redirected to the success page with a trackable
              order reference.
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                isRemoteSyncing ||
                couponStatus === "loading" ||
                isPreviewBlockingSubmission ||
                couponBlocksSubmission
              }
              aria-busy={isSubmitting}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-7 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className={`h-4 w-4 rounded-full border-2 border-white/40 border-t-white ${
                  isSubmitting ? "animate-spin" : "opacity-0"
                }`}
              />
              <span>
                {isSubmitting ? "Processing..." : checkoutCopy.buttons.confirmButtonLabel}
              </span>
            </button>
            {isPreviewBlockingSubmission ? (
              <p className="mt-3 text-center text-xs leading-5 text-amber-600">
                Resolve the blocked store groups or invalid items above before placing this order.
              </p>
            ) : null}
            {couponBlocksSubmission ? (
              <p className="mt-3 text-center text-xs leading-5 text-amber-600">
                Remove the applied coupon before placing this order. Coupon settlement is not open
                in the current split checkout flow yet.
              </p>
            ) : null}
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              By placing this order, you confirm the contact and shipping details above.
            </p>
          </div>
        </aside>
      </form>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, Trash2, WalletCards } from "lucide-react";
import { createOrderSchema } from "@ecommerce/schemas";
import { useCartStore } from "../../store/cart.store.ts";
import {
  createStoreOrder,
  getStoreCustomization,
  quoteStoreCoupon,
} from "../../api/store.service.ts";
import { getDefaultAddress, listAddresses } from "../../api/userAddresses.ts";
import { formatCurrency } from "../../utils/format.js";
import { GENERIC_ERROR, ORDER_FAILED } from "../../constants/uiMessages.js";

const INPUT_CLASS =
  "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-[0_1px_1px_rgba(15,23,42,0.03)] focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";

const SHIPPING_OPTIONS_BASE = [
  { id: "ups_today", cost: 60 },
  { id: "ups_7_days", cost: 20 },
];

const PAYMENT_OPTIONS = [
  {
    id: "cash",
    title: "Cash",
    hint: "Pay after delivery",
    Icon: Banknote,
  },
  {
    id: "card",
    title: "Card",
    hint: "Visa / Mastercard",
    Icon: CreditCard,
  },
  {
    id: "razorpay",
    title: "RazorPay",
    hint: "Fast online payment",
    Icon: WalletCards,
  },
];

const DEFAULT_STORE_SETTINGS_FLAGS = {
  payments: {
    cashOnDeliveryEnabled: true,
    stripeEnabled: true,
    razorPayEnabled: false,
  },
};

const normalizeStoreSettingsFlags = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const payments =
    source.payments && typeof source.payments === "object" ? source.payments : {};
  return {
    payments: {
      cashOnDeliveryEnabled:
        typeof payments.cashOnDeliveryEnabled === "boolean"
          ? payments.cashOnDeliveryEnabled
          : DEFAULT_STORE_SETTINGS_FLAGS.payments.cashOnDeliveryEnabled,
      stripeEnabled:
        typeof payments.stripeEnabled === "boolean"
          ? payments.stripeEnabled
          : DEFAULT_STORE_SETTINGS_FLAGS.payments.stripeEnabled,
      razorPayEnabled:
        typeof payments.razorPayEnabled === "boolean"
          ? payments.razorPayEnabled
          : DEFAULT_STORE_SETTINGS_FLAGS.payments.razorPayEnabled,
    },
  };
};

const LAST_ORDER_REF_STORAGE_KEY = "store_last_order_ref";
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
    streetAddressLabel: "Street Address",
    cityLabel: "City",
    countryLabel: "Country",
    zipLabel: "Zip Code",
    streetAddressPlaceholder: "Street Address",
    cityPlaceholder: "City",
    countryPlaceholder: "Country",
    zipPlaceholder: "Zip Code",
    shippingCostLabel: "Shipping Cost",
    shippingOneNameDefault: "UPS Delivery",
    shippingOneDescriptionDefault: "Delivery: Today Cost :",
    shippingTwoNameDefault: "UPS Delivery",
    shippingTwoDescriptionDefault: "Delivery: 7 Days Cost :",
    paymentMethodLabel: "Payment Method",
    paymentMethodPlaceholder: "Select a preferred payment option.",
  },
  buttons: {
    continueButtonLabel: "Back to Cart",
    confirmButtonLabel: "Place Order",
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
      streetAddressLabel: toCopyText(
        shippingDetails.streetAddressLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.streetAddressLabel
      ),
      cityLabel: toCopyText(
        shippingDetails.cityLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.cityLabel
      ),
      countryLabel: toCopyText(
        shippingDetails.countryLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.countryLabel
      ),
      zipLabel: toCopyText(
        shippingDetails.zipLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.zipLabel
      ),
      streetAddressPlaceholder: toCopyText(
        shippingDetails.streetAddressPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.streetAddressPlaceholder
      ),
      cityPlaceholder: toCopyText(
        shippingDetails.cityPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.cityPlaceholder
      ),
      countryPlaceholder: toCopyText(
        shippingDetails.countryPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.countryPlaceholder
      ),
      zipPlaceholder: toCopyText(
        shippingDetails.zipPlaceholder,
        DEFAULT_CHECKOUT_COPY.shippingDetails.zipPlaceholder
      ),
      shippingCostLabel: toCopyText(
        shippingDetails.shippingCostLabel,
        DEFAULT_CHECKOUT_COPY.shippingDetails.shippingCostLabel
      ),
      shippingOneNameDefault: toCopyText(
        shippingDetails.shippingOneNameDefault,
        DEFAULT_CHECKOUT_COPY.shippingDetails.shippingOneNameDefault
      ),
      shippingOneDescriptionDefault: toCopyText(
        shippingDetails.shippingOneDescriptionDefault,
        DEFAULT_CHECKOUT_COPY.shippingDetails.shippingOneDescriptionDefault
      ),
      shippingTwoNameDefault: toCopyText(
        shippingDetails.shippingTwoNameDefault,
        DEFAULT_CHECKOUT_COPY.shippingDetails.shippingTwoNameDefault
      ),
      shippingTwoDescriptionDefault: toCopyText(
        shippingDetails.shippingTwoDescriptionDefault,
        DEFAULT_CHECKOUT_COPY.shippingDetails.shippingTwoDescriptionDefault
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
      confirmButtonLabel: toCopyText(
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

const splitFullName = (fullName) => {
  const normalized = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!normalized) return { firstName: "", lastName: "" };
  const [first, ...rest] = normalized.split(" ");
  return {
    firstName: first || "",
    lastName: rest.join(" "),
  };
};

const getStreetAddressFromUserAddress = (address) =>
  [
    `${address?.streetName || ""} ${address?.houseNumber || ""}`.trim(),
    address?.building || "",
    address?.otherDetails || "",
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

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
  const { storeSettings } = useOutletContext() || {};
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
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [useDefaultShipping, setUseDefaultShipping] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [addressStatus, setAddressStatus] = useState("");
  const [shippingOptionId, setShippingOptionId] = useState(SHIPPING_OPTIONS_BASE[0].id);
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
    streetAddress: "",
    city: "",
    country: "",
    zipCode: "",
  });
  const submitLockRef = useRef(false);
  const firstNameRef = useRef(null);
  const phoneRef = useRef(null);
  const streetRef = useRef(null);
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
  const storeSettingsFlags = useMemo(
    () => normalizeStoreSettingsFlags(storeSettings),
    [storeSettings]
  );
  const paymentOptions = useMemo(
    () =>
      PAYMENT_OPTIONS.filter((option) => {
        if (option.id === "cash") return storeSettingsFlags.payments.cashOnDeliveryEnabled;
        if (option.id === "card") return storeSettingsFlags.payments.stripeEnabled;
        if (option.id === "razorpay") return storeSettingsFlags.payments.razorPayEnabled;
        return true;
      }),
    [storeSettingsFlags]
  );

  useEffect(() => {
    if (paymentOptions.length === 0) return;
    const hasSelected = paymentOptions.some((option) => option.id === paymentOptionId);
    if (hasSelected) return;
    setPaymentOptionId(paymentOptions[0].id);
  }, [paymentOptions, paymentOptionId]);

  const shippingOptions = useMemo(
    () => [
      {
        ...SHIPPING_OPTIONS_BASE[0],
        title: checkoutCopy.shippingDetails.shippingOneNameDefault,
        descriptionText: checkoutCopy.shippingDetails.shippingOneDescriptionDefault,
      },
      {
        ...SHIPPING_OPTIONS_BASE[1],
        title: checkoutCopy.shippingDetails.shippingTwoNameDefault,
        descriptionText: checkoutCopy.shippingDetails.shippingTwoDescriptionDefault,
      },
    ],
    [checkoutCopy]
  );

  useEffect(() => {
    if (!checkoutCustomizationQuery.isError) return;
    console.warn("[checkout] failed to load checkout customization; using defaults.");
  }, [checkoutCustomizationQuery.isError]);

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

  useEffect(() => {
    if (!resolveHasAuthHint()) return;
    let active = true;
    (async () => {
      try {
        const items = await listAddresses();
        if (!active) return;
        setSavedAddresses(Array.isArray(items) ? items : []);
      } catch {
        if (!active) return;
        setSavedAddresses([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const hasItems = items.length > 0;
  const isAuthenticated = resolveHasAuthHint();
  const lockAddressFields = isSubmitting || useDefaultShipping || isAddressLoading;
  const shippingOption =
    shippingOptions.find((option) => option.id === shippingOptionId) ||
    shippingOptions[0];
  const shippingCost = Number(shippingOption?.cost || 0);

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

  const subtotalValue = Number(subtotal || 0);
  const discountValue = Number(discount || 0);
  const taxValue = 0;
  const quotedTotalValue = Number(appliedCouponMeta?.total);
  const total = Number.isFinite(quotedTotalValue)
    ? Math.max(0, quotedTotalValue)
    : Math.max(0, subtotalValue + shippingCost - discountValue);

  const fullName = `${firstName} ${lastName}`.trim();
  const shippingAddress = [
    streetAddress.trim(),
    city.trim(),
    country.trim(),
    zipCode.trim(),
  ]
    .filter(Boolean)
    .join(", ");
  const phoneValue = phone.trim();
  const paymentMethod = "COD";
  const shippingDetailsPayload = useMemo(
    () => ({
      fullName,
      phoneNumber: phoneValue,
      province: country.trim(),
      city: city.trim(),
      district: city.trim(),
      postalCode: zipCode.trim(),
      streetName: streetAddress.trim(),
      building: "",
      houseNumber: "N/A",
      otherDetails: "",
      markAs: "HOME",
    }),
    [fullName, phoneValue, country, city, zipCode, streetAddress]
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
  const applyAddressToCheckoutForm = (address) => {
    const normalized = address && typeof address === "object" ? address : {};
    const fullNameParts = splitFullName(normalized.fullName);
    setFirstName(fullNameParts.firstName);
    setLastName(fullNameParts.lastName);
    setPhone(String(normalized.phoneNumber || ""));
    setStreetAddress(getStreetAddressFromUserAddress(normalized));
    setCity(String(normalized.city || ""));
    setCountry(String(normalized.province || ""));
    setZipCode(String(normalized.postalCode || ""));
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
      setSelectedAddressId(String(defaultAddress.id || ""));
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

  const handleSelectSavedAddress = (event) => {
    const nextId = String(event.target.value || "");
    setSelectedAddressId(nextId);
    if (!nextId) return;
    const selected = savedAddresses.find((item) => String(item?.id || "") === nextId);
    if (!selected) return;
    setUseDefaultShipping(false);
    setAddressStatus("");
    applyAddressToCheckoutForm(selected);
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
      streetAddress: "",
      city: "",
      country: "",
      zipCode: "",
    });

    if (!firstName.trim() || !lastName.trim() || !phoneValue || !streetAddress.trim()) {
      setError("Please complete required checkout fields.");
      const nextErrors = {
        firstName: firstName.trim() ? "" : "First name is required.",
        lastName: lastName.trim() ? "" : "Last name is required.",
        phone: phoneValue ? "" : "Phone is required.",
        streetAddress: streetAddress.trim() ? "" : "Street address is required.",
        city: city.trim() ? "" : "City is required.",
        country: country.trim() ? "" : "Country is required.",
        zipCode: zipCode.trim() ? "" : "ZIP code is required.",
      };
      setFieldErrors(nextErrors);
      if (nextErrors.firstName) {
        focusField(firstNameRef);
      } else if (nextErrors.phone) {
        focusField(phoneRef);
      } else if (nextErrors.streetAddress) {
        focusField(streetRef);
      }
      return;
    }

    if (!/^\d{5}$/.test(zipCode.trim())) {
      setError("ZIP code must be 5 digits.");
      setFieldErrors((prev) => ({
        ...prev,
        zipCode: "ZIP code must be 5 digits.",
      }));
      focusField(streetRef);
      return;
    }

    const parsed = createOrderSchema.safeParse(payloadDraft);
    if (!parsed.success) {
      const nextErrors = {
        firstName: "",
        lastName: "",
        phone: "",
        streetAddress: "",
        city: "",
        country: "",
        zipCode: "",
      };
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path === "customer.name") {
          nextErrors.firstName = issue.message;
        }
        if (path === "customer.phone") {
          nextErrors.phone = issue.message;
        }
        if (path === "customer.address") {
          nextErrors.streetAddress = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      setError("Please check highlighted fields.");
      if (nextErrors.firstName) {
        focusField(firstNameRef);
      } else if (nextErrors.phone) {
        focusField(phoneRef);
      } else if (nextErrors.streetAddress) {
        focusField(streetRef);
      }
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const submitPayload = {
        ...parsed.data,
        useDefaultShipping,
        shippingDetails: useDefaultShipping ? undefined : shippingDetailsPayload,
      };
      const response = await createStoreOrder(submitPayload);
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
      const successParams = new URLSearchParams();
      if (resolvedOrderRef) {
        successParams.set("ref", resolvedOrderRef);
      }
      navigate(
        `/checkout/success${successParams.size > 0 ? `?${successParams.toString()}` : ""}`,
        {
          state: { ref: resolvedOrderRef || "" },
        }
      );
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
      if (err?.response?.status === 400 && Array.isArray(data?.missing)) {
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
                <p className="mt-1 text-sm text-slate-500">
                  Complete your delivery details and confirm order.
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

            {isAuthenticated ? (
              <div className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Select Saved Address
                </label>
                <select
                  value={selectedAddressId}
                  onChange={handleSelectSavedAddress}
                  disabled={isSubmitting || isAddressLoading || savedAddresses.length === 0}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Choose saved address</option>
                  {savedAddresses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName} - {item.city}, {item.province}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {useDefaultShipping ? (
              <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {isAddressLoading
                  ? "Loading your default shipping address..."
                  : "Use Default Shipping Address is enabled."}
              </p>
            ) : null}

            {!useDefaultShipping && addressStatus ? (
              <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {addressStatus}
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
                  hint="Choose destination and shipping option."
                />
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      {checkoutCopy.shippingDetails.streetAddressLabel} *
                    </label>
                    <input
                      ref={streetRef}
                      type="text"
                      value={streetAddress}
                      onChange={(event) => {
                        setStreetAddress(event.target.value);
                        if (fieldErrors.streetAddress) {
                          setFieldErrors((prev) => ({ ...prev, streetAddress: "" }));
                        }
                      }}
                      disabled={lockAddressFields}
                      placeholder={checkoutCopy.shippingDetails.streetAddressPlaceholder}
                      className={fieldClass(Boolean(fieldErrors.streetAddress))}
                    />
                    {fieldErrors.streetAddress ? (
                      <p className="mt-1 text-xs text-rose-600">{fieldErrors.streetAddress}</p>
                    ) : null}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.cityLabel} *
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(event) => {
                          setCity(event.target.value);
                          if (fieldErrors.city) {
                            setFieldErrors((prev) => ({ ...prev, city: "" }));
                          }
                        }}
                        disabled={lockAddressFields}
                        placeholder={checkoutCopy.shippingDetails.cityPlaceholder}
                        className={fieldClass(Boolean(fieldErrors.city))}
                      />
                      {fieldErrors.city ? (
                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.city}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.countryLabel} *
                      </label>
                      <input
                        type="text"
                        value={country}
                        onChange={(event) => {
                          setCountry(event.target.value);
                          if (fieldErrors.country) {
                            setFieldErrors((prev) => ({ ...prev, country: "" }));
                          }
                        }}
                        disabled={lockAddressFields}
                        placeholder={checkoutCopy.shippingDetails.countryPlaceholder}
                        className={fieldClass(Boolean(fieldErrors.country))}
                      />
                      {fieldErrors.country ? (
                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.country}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        {checkoutCopy.shippingDetails.zipLabel} *
                      </label>
                      <input
                        type="text"
                        value={zipCode}
                        onChange={(event) => {
                          setZipCode(event.target.value);
                          if (fieldErrors.zipCode) {
                            setFieldErrors((prev) => ({ ...prev, zipCode: "" }));
                          }
                        }}
                        disabled={lockAddressFields}
                        placeholder={checkoutCopy.shippingDetails.zipPlaceholder}
                        className={fieldClass(Boolean(fieldErrors.zipCode))}
                      />
                      {fieldErrors.zipCode ? (
                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.zipCode}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-xs font-semibold uppercase text-slate-600">
                    {checkoutCopy.shippingDetails.shippingCostLabel}
                  </p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {shippingOptions.map((option) => {
                      const selected = shippingOptionId === option.id;
                      return (
                        <label
                          key={option.id}
                          className={`cursor-pointer rounded-2xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition ${
                            selected
                              ? "border-emerald-400 bg-emerald-50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="shippingOption"
                            className="sr-only"
                            checked={selected}
                            onChange={() => setShippingOptionId(option.id)}
                          />
                          <div className="text-sm font-semibold text-slate-900">
                            {option.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {option.descriptionText} {formatCurrency(option.cost)}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <SectionTitle
                  number="03."
                  title={checkoutCopy.shippingDetails.paymentMethodLabel}
                  hint={checkoutCopy.shippingDetails.paymentMethodPlaceholder}
                />
                {paymentOptions.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {paymentOptions.map((option) => {
                      const selected = paymentOptionId === option.id;
                      const Icon = option.Icon;
                      return (
                        <label
                          key={option.id}
                            className={`cursor-pointer rounded-2xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition ${
                              selected
                                ? "border-emerald-400 bg-emerald-50"
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
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {option.title}
                              </div>
                              <div className="text-xs text-slate-500">{option.hint}</div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    No payment options are configured. Orders are processed as COD in this
                    environment.
                  </div>
                )}
                {paymentOptionId !== "cash" && paymentOptions.length > 0 ? (
                  <p className="text-xs text-amber-600">
                    For now, checkout is processed as COD in this environment.
                  </p>
                ) : null}
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
                  <span>{checkoutCopy.shippingDetails.shippingCostLabel}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatCurrency(shippingCost)}
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

            <button
              type="submit"
              disabled={isSubmitting || isRemoteSyncing || couponStatus === "loading"}
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
          </div>
        </aside>
      </form>
    </section>
  );
}

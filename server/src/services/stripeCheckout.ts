import Stripe from "stripe";

type StripeLineItemInput = {
  name: string;
  quantity: number;
  unitAmount: number;
};

type StripeCheckoutSessionLike = {
  id?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, any> | null;
  payment_status?: string | null;
  status?: string | null;
};

const normalizeBaseUrl = (value: unknown) => String(value || "").trim().replace(/\/+$/, "");

export const resolveStripeCheckoutBaseUrl = (input: {
  explicitBaseUrl?: unknown;
  origin?: unknown;
  protocol?: unknown;
  host?: unknown;
}) => {
  const explicitBaseUrl = normalizeBaseUrl(input.explicitBaseUrl);
  if (/^https?:\/\//i.test(explicitBaseUrl)) {
    return explicitBaseUrl;
  }

  const origin = normalizeBaseUrl(input.origin);
  if (/^https?:\/\//i.test(origin)) {
    return origin;
  }

  const host = String(input.host || "").trim();
  if (!host) return "";
  const protocol = String(input.protocol || "http").trim().toLowerCase() || "http";
  return `${protocol}://${host}`.replace(/\/+$/, "");
};

const createStripeClient = (secretKey: string) => new Stripe(secretKey);

export const constructStripeWebhookEvent = (input: {
  payload: Buffer | string;
  signature: string;
  signingSecret: string;
}) => {
  const stripe = createStripeClient("sk_test_placeholder");
  return stripe.webhooks.constructEvent(
    input.payload,
    input.signature,
    input.signingSecret
  );
};

export const createStripeCheckoutSession = async (input: {
  secretKey: string;
  baseUrl: string;
  invoiceNo: string;
  orderId: number;
  amountTotal: number;
  lineItems: StripeLineItemInput[];
  customerEmail?: string | null;
  customerName?: string | null;
  currency?: string;
}) => {
  const stripe = createStripeClient(input.secretKey);
  const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl);
  if (!/^https?:\/\//i.test(normalizedBaseUrl)) {
    throw new Error("Stripe checkout base URL is invalid.");
  }

  const successUrl = `${normalizedBaseUrl}/checkout/success?ref=${encodeURIComponent(
    input.invoiceNo
  )}&method=STRIPE&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${normalizedBaseUrl}/checkout/success?ref=${encodeURIComponent(
    input.invoiceNo
  )}&method=STRIPE&cancelled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: input.invoiceNo,
    customer_email: input.customerEmail || undefined,
    payment_method_types: ["card"],
    metadata: {
      orderId: String(input.orderId),
      invoiceNo: input.invoiceNo,
      paymentMethod: "STRIPE",
      integrationScope: "single_store_checkout",
      customerName: input.customerName ? String(input.customerName) : "",
    },
    line_items: input.lineItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: String(input.currency || "idr").toLowerCase(),
        unit_amount: item.unitAmount,
        product_data: {
          name: item.name,
        },
      },
    })),
  });

  return {
    sessionId: session.id,
    url: session.url || null,
    status: session.status || null,
    paymentStatus: session.payment_status || null,
    amountTotal: Number(session.amount_total || input.amountTotal || 0),
  };
};

export const retrieveStripeCheckoutSession = async (input: {
  secretKey: string;
  sessionId: string;
}) => {
  const stripe = createStripeClient(input.secretKey);
  return stripe.checkout.sessions.retrieve(input.sessionId);
};

export const getStripeSessionInvoiceNo = (session: StripeCheckoutSessionLike) =>
  String(session?.client_reference_id || session?.metadata?.invoiceNo || "").trim();

export const getStripeSessionOrderId = (session: StripeCheckoutSessionLike) => {
  const parsed = Number(session?.metadata?.orderId || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const isStripeCheckoutSessionPaid = (session: StripeCheckoutSessionLike) =>
  String(session?.payment_status || "").trim().toLowerCase() === "paid";

import express, { Request, Response, Router } from "express";
import {
  constructStripeWebhookEvent,
  getStripeSessionInvoiceNo,
} from "../services/stripeCheckout.js";
import {
  ensureSettingsTable,
  getPersistedStoreSettings,
  getStripeWebhookConfig,
} from "../services/storeSettings.js";
import { syncStoreOrderFromStripeSession } from "../services/stripeOrderSync.js";

const router = Router();

const SUPPORTED_STRIPE_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "checkout.session.async_payment_failed",
]);

router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req: Request, res: Response) => {
    try {
      const signature = String(req.get("stripe-signature") || "").trim();
      if (!signature) {
        return res.status(400).json({
          success: false,
          code: "STRIPE_WEBHOOK_SIGNATURE_MISSING",
          message: "Stripe webhook signature is required.",
        });
      }

      await ensureSettingsTable();
      const storeSettings = await getPersistedStoreSettings();
      const stripeWebhookConfig = getStripeWebhookConfig(storeSettings);
      if (!stripeWebhookConfig.enabled) {
        return res.status(503).json({
          success: false,
          code: "STRIPE_WEBHOOK_NOT_READY",
          message: "Stripe webhook signing secret is not configured.",
        });
      }

      const payload = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
      let event;
      try {
        event = constructStripeWebhookEvent({
          payload,
          signature,
          signingSecret: stripeWebhookConfig.signingSecret,
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          code: "STRIPE_WEBHOOK_SIGNATURE_INVALID",
          message: "Stripe webhook signature verification failed.",
        });
      }

      if (!SUPPORTED_STRIPE_WEBHOOK_EVENTS.has(String(event.type || ""))) {
        return res.json({
          success: true,
          received: true,
          handled: false,
          eventId: String(event.id || ""),
          eventType: String(event.type || ""),
        });
      }

      const session = event.data?.object;
      if (!session || String((session as any).object || "") !== "checkout.session") {
        return res.json({
          success: true,
          received: true,
          handled: false,
          eventId: String(event.id || ""),
          eventType: String(event.type || ""),
        });
      }

      const syncResult = await syncStoreOrderFromStripeSession({
        session: session as any,
        source: "webhook",
      });

      if (!syncResult.ok && syncResult.reason === "order_not_found") {
        return res.status(404).json({
          success: false,
          code: "STRIPE_WEBHOOK_ORDER_NOT_FOUND",
          message: "Stripe webhook order target was not found.",
          data: {
            eventId: String(event.id || ""),
            invoiceNo: getStripeSessionInvoiceNo(session as any) || null,
          },
        });
      }

      if (!syncResult.ok && syncResult.reason === "payment_method_mismatch") {
        return res.status(409).json({
          success: false,
          code: "STRIPE_WEBHOOK_PAYMENT_METHOD_MISMATCH",
          message: "Stripe webhook order target does not use Stripe.",
          data: {
            eventId: String(event.id || ""),
            invoiceNo: syncResult.invoiceNo || null,
          },
        });
      }

      if (!syncResult.ok) {
        return res.status(422).json({
          success: false,
          code: "STRIPE_WEBHOOK_EVENT_INVALID",
          message: "Stripe webhook payload could not be mapped to an order.",
          data: {
            eventId: String(event.id || ""),
            invoiceNo: syncResult.invoiceNo || null,
          },
        });
      }

      return res.json({
        success: true,
        received: true,
        handled: true,
        data: {
          eventId: String(event.id || ""),
          eventType: String(event.type || ""),
          invoiceNo: syncResult.invoiceNo,
          orderId: syncResult.orderId,
          paid: syncResult.paid,
          updated: syncResult.updated,
          alreadyFinalized: syncResult.alreadyFinalized,
        },
      });
    } catch (error) {
      console.error("[store/stripe/webhook] failed", error);
      return res.status(500).json({
        success: false,
        code: "STRIPE_WEBHOOK_INTERNAL_ERROR",
        message: "Failed to process Stripe webhook.",
      });
    }
  }
);

export default router;

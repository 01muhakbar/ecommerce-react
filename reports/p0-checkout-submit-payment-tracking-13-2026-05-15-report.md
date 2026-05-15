# P0-CHECKOUT-SUBMIT-PAYMENT-TRACKING-13 Report

Date: 2026-05-15

## Scope
- Audited public checkout submit flow from ready preview to payment and tracking.
- Added browser E2E coverage for a real checkout submit without mocking the create-order endpoint.
- No checkout, payment, tracking UX redesign.
- No lifecycle, pricing, schema, or route contract changes.

## Frontend <-> Backend Sync Check
1. `Place an Order` calls `createMultiStoreCheckoutOrder`, which posts to `/api/checkout/create-multi-store`.
2. Submit payload includes customer/shipping data, coupons when present, optional cart id, and `checkoutRequestKey`.
3. Submit sends `checkoutRequestKey` generated from the current checkout signature.
4. Submit and preview use the same backend cart loading path, including active payment profile lookup and duplicate-line safety.
5. Create response returns `orderId`, `invoiceNo`/`ref`, `checkoutMode`, `paymentStatus`, `paymentMethod`, and split `groups`.
6. Payment page loads by internal `orderId` from `/user/my-orders/:id/payment`, using `/api/orders/:id/checkout-payment`.
7. Public tracking loads by external invoice reference from `/order/:ref`, using `/api/store/orders/:ref`.
8. Backend clears cart items in the checkout transaction after order/suborder/payment creation. Frontend clears local cart after successful response.
9. If redirect fails after response, the backend response still contains `invoiceNo`/`ref`; no fallback UI change was made in this task.
10. Existing backend smoke covers initial order/payment/tracking states. New E2E covers the missing real browser submit path.

## Changes
- `tools/qa/e2e-truth-smoke.ts`
  - Added a fresh buyer scenario for Organic Banana qty 1.
  - Opens `/checkout`, verifies preview is ready and not preview-sync blocked.
  - Fills required shipping/contact fields.
  - Clicks `Place an Order` and asserts exactly one create request.
  - Asserts `checkoutRequestKey` is sent.
  - Asserts create response has `UNPAID` parent payment status, `CREATED` payment status, amount `25000`, payment instruction, and deadline.
  - Asserts redirect to `/user/my-orders/:id/payment`.
  - Asserts payment page shows invoice, amount `Rp 25.000`, payment UI, and deadline.
  - Asserts backend cart is cleared.
  - Asserts public tracking API and `/order/:ref` read the same invoice and total.

## Admin/Seller/Client Impact
- Admin: no route or UI contract changes.
- Seller: no route or UI contract changes.
- Client: checkout submit flow is now covered end-to-end; no UI behavior was changed.

## Validation
- `pnpm.cmd -F server build` PASS
- `pnpm.cmd -F client build` PASS
- `pnpm.cmd -F server smoke:checkout-variants` PASS
- `pnpm.cmd -F server smoke:checkout-coupons` PASS
- `pnpm.cmd -F server smoke:order-payment` PASS
- `pnpm.cmd qa:e2e:truth` PASS

## Notes
- An initial parallel smoke run caused a transient MySQL deadlock in `smoke:checkout-variants` add-to-cart setup. Running the required validation serially passed.
- `qa:e2e:truth` still logs existing missing demo/branding image 404s and an add-to-cart deadlock trace from a retried fixture path, but the command completed `OK` with exit code 0.

## Risk
- Low. Production code was not changed for this task.
- Coverage is intentionally focused on the public buyer checkout path and avoids brittle style assertions.

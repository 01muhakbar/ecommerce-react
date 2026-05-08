# Multivendor Order Status Truth Table

This document is the operational source of truth for multivendor checkout status handling across `Admin`, `Seller`, and `Client`.

## Canonical Status Layers

- Parent payment status: aggregate settlement state of all active suborders.
- Parent order status: aggregate operational state of all active suborders.
- Suborder payment status: seller-scoped settlement state for one store split.
- Suborder compatibility fulfillment status: legacy-compatible storage for one store split.
- Shipment status: canonical persisted shipment state for one store split.

## Seller Split Truth Table

| Canonical backend condition | Seller workspace status | Admin reading | Client label | Valid seller CTA |
| --- | --- | --- | --- | --- |
| `payment=UNPAID/CREATED/REJECTED/EXPIRED/CANCELLED`, shipment blocked | Waiting payment / payment action required | Payment not settled, shipment blocked | Awaiting payment / Under review / Expired / Cancelled | No fulfillment CTA |
| `payment=PENDING_CONFIRMATION`, shipment blocked | Payment under review | Awaiting seller review | Payment under review | No fulfillment CTA |
| `payment=PAID`, `shipment=READY_TO_FULFILL`, `fulfillment=UNFULFILLED` | Ready to pack | Paid, not packed yet | Preparing for shipment | `Mark packed` |
| `payment=PAID`, `shipment=PACKED`, `fulfillment=PROCESSING` | Packed | Packed / waiting dispatch | Packed | `Mark shipped` |
| `payment=PAID`, `shipment=SHIPPED`, `fulfillment=SHIPPED` | Shipped | Shipped with tracking | Shipped | `Mark delivered`, `Mark delivery failed` |
| `payment=PAID`, `shipment=FAILED_DELIVERY`, `fulfillment=SHIPPED` | Delivery failed | Shipping exception | Delivery issue | `Mark returned` or admin reconciliation |
| `payment=PAID`, `shipment=RETURNED`, `fulfillment=SHIPPED` | Returned | Returned shipment final state | Return in progress / Returned | No seller forward CTA |
| `payment=PAID`, `shipment=DELIVERED`, `fulfillment=DELIVERED` | Delivered | Delivered | Delivered | No seller forward CTA |
| `shipment=CANCELLED`, `fulfillment=CANCELLED` | Cancelled | Cancelled before dispatch | Cancelled | No seller forward CTA |

## Mandatory Seller Sequence

1. Seller approves payment proof.
2. Split becomes `payment=PAID` and `shipment=READY_TO_FULFILL`.
3. Seller presses `Mark packed` when parcel is ready to leave the store.
4. Seller presses `Mark shipped` only after handoff to courier.
5. `Mark shipped` requires:
   - tracking number
   - at least one courier identifier (`courierCode` or `courierService`)
6. Seller can press `Mark delivered` only after shipment is already dispatched.

## Parent Order Aggregation Rules

- `pending`
  Active suborders exist, but none has started operational fulfillment yet.
- `processing`
  At least one active suborder has started packing or shipping, but not every active suborder is already `SHIPPED` or `DELIVERED`.
- `shipped`
  Every active suborder is `SHIPPED` or `DELIVERED`, and at least one active suborder is still in a shipped-like stage.
- `delivered`
  Every active suborder is `DELIVERED`.
- `cancelled`
  No active suborders remain.

Important:

- Parent order must not remain ahead of the latest active suborder aggregate.
- If one of two sellers is already shipped, parent order stays `processing`, not `shipped`.
- Order-level shipment aggregate must not claim `shipped` until every active split is already shipped or delivered.

## Backend Guard Rules

- `Mark packed` is invalid before split payment is settled.
- `Mark shipped` is invalid without tracking number.
- `Mark shipped` is invalid without at least one courier field.
- `Mark delivered` is invalid before `SHIPPED`.
- Shipment mutation is invalid after parent order is `cancelled`, `delivered`, or `completed`.
- Admin correction cannot bypass invalid shipment transitions.

## Presentation Rules

- Seller sees operational language: `Mark packed`, `Mark shipped`, `Mark delivered`.
- Admin sees the same operational truth plus audit metadata.
- Client must see buyer-friendly labels:
  - `READY_TO_FULFILL` -> `Preparing for shipment`
  - `PACKED` -> `Packed`
  - exception states stay descriptive and non-technical where possible

## Acceptance Checks

- Approving payment must not auto-pack a split.
- A shipped split must retain tracking and courier identity.
- Parent order must not appear fully shipped when only part of the order is shipped.
- Frontend may hide invalid actions, but backend remains the final guard.

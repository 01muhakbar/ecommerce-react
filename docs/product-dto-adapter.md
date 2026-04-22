# Product DTO Adapter

Canonical frontend contract lives in [client/src/api/productDto.ts](../client/src/api/productDto.ts).

## Canonical DTO

- `ProductListItemDTO`: stable list shape for Admin and Seller consumers.
- `ProductDetailDTO`: stable detail shape that keeps Seller's richer nested sections.
- `ProductWriteDTO`: canonical write input before lane-specific payload mapping.

## Write Field Parity

| Field | Admin | Seller | Notes |
| --- | --- | --- | --- |
| `name` | `same` | `same` | Required on create for both. Seller update still requires it today. |
| `description` | `same` | `same` | Shared text field. |
| `sku` | `same` | `same` | Shared optional identifier. |
| `barcode` | `same` | `same` | Shared optional barcode. |
| `slug` | `same` | `same` | Shared normalized slug. |
| `categoryIds` | `same` | `same` | Shared multi-category selector. |
| `defaultCategoryId` | `same` | `same` | Shared primary category pointer. |
| `price` | `same` | `same` | Shared base price. |
| `salePrice` | `same` | `same` | Shared discount price. |
| `stock` | `same` | `same` | Shared inventory quantity. |
| `imageUrls` | `same` | `same` | Shared gallery array. |
| `tags` | `same` | `same` | Shared tag list. |
| `status` | `compatible` | `forbidden` | Admin controls lifecycle directly. Seller draft lane cannot send it. |
| `published` | `same` | `forbidden` | Seller publish stays on a dedicated endpoint. |
| `seo` | `same` | `unsupported` | Seller lane does not accept SEO payload yet. |
| `variations` | `same` | `unsupported` | Seller lane does not accept variants payload yet. |

## Read Mapping Rules

- Seller raw list/detail payloads are mapped directly into canonical DTOs.
- Admin raw list/detail payloads are promoted into the same canonical DTO shape.
- Canonical DTO keeps Seller-style nested sections:
  - `pricing`
  - `inventory`
  - `submission`
  - `publishing`
  - `category`
  - `media`
  - `visibility`

## Current Rollout

- Seller consumers are wired to the canonical DTO adapter first.
- Admin mappers exist and are ready for follow-up adoption.
- No server route, schema, enum, or endpoint contract was changed.

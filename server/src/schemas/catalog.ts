import { z } from "zod";

export const ProductQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  q: z.string().optional(),
  categoryId: z.coerce.number().optional(),
  status: z.enum(["selling","soldout"]).optional(),
  sort: z.enum(["name","price","stock","createdAt"]).default("createdAt"),
  order: z.enum(["asc","desc"]).default("desc"),
});

export const ProductCreateSchema = z.object({
  name: z.string().min(2),
  categoryId: z.coerce.number(),
  price: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative().default(0),
  stock: z.coerce.number().nonnegative().default(0),
  status: z.enum(["selling","soldout"]).default("selling"),
  published: z.boolean().default(true),
});

export const ProductUpdateSchema = ProductCreateSchema.partial();

export const TogglePublishSchema = z.object({
  published: z.boolean(),
});

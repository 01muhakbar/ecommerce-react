import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().nonnegative("Price must be >= 0"),
});

export type ProductInput = z.infer<typeof productSchema>;

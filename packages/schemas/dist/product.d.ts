import { z } from "zod";
export declare const createProductSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    price: z.ZodString;
    stock: z.ZodString;
    categoryId: z.ZodString;
}, z.core.$strip>;
export type CreateProductInput = z.infer<typeof createProductSchema>;

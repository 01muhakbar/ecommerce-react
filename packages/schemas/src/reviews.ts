import { z } from "zod";

export const reviewImagesSchema = z
  .array(z.string().min(1).max(900000))
  .max(4)
  .optional();

export const reviewCreateSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  images: reviewImagesSchema,
});

export const reviewUpdateSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(2000).optional(),
    images: reviewImagesSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const reviewSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
export type ReviewOutput = z.infer<typeof reviewSchema>;

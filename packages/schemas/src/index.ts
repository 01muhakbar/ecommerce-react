import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["pembeli", "penjual"]).optional(),
});

const phoneNumberSchema = z
  .string()
  .trim()
  .min(8)
  .max(20)
  .refine((value) => /^[0-9+\s()-]+$/.test(value), {
    message: "Invalid phone number format",
  })
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 16;
  }, "Phone number is invalid");

const passwordStrengthSchema = z
  .string()
  .min(8)
  .max(72)
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: "Password must contain letters and numbers",
  });

export const clientRegistrationSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    email: z.string().trim().email().max(160),
    phoneNumber: phoneNumberSchema,
    password: passwordStrengthSchema,
    passwordConfirm: z.string().min(8).max(72),
    termsAccepted: z.boolean().refine((value) => value === true, {
      message: "Terms and privacy consent is required",
    }),
    honeypot: z.string().max(0).optional().default(""),
    startedAt: z.coerce.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password confirmation does not match",
        path: ["passwordConfirm"],
      });
    }
  });

export const clientRegistrationVerifySchema = z.object({
  verificationId: z.string().trim().min(12).max(96),
  otpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Verification code must contain 6 digits"),
});

export const clientRegistrationResendSchema = z.object({
  verificationId: z.string().trim().min(12).max(96),
});

export const loginAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const forgotPasswordAdminSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordAdminSchema = z.object({
  password: z.string().min(6),
  token: z.string(),
});

export const updateProfileSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export const createProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  description: z.string(),
  stock: z.number(),
  categoryId: z.number(),
  images: z.array(z.string()).optional(),
});

export const createOrderItemSchema = z.object({
  productId: z.number().int().positive(),
  qty: z.number().int().min(1),
});

export const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(2),
    phone: z
      .string()
      .trim()
      .min(8)
      .max(16)
      .refine((value) => /^[0-9+\s-]+$/.test(value), {
        message: "Invalid phone format",
      })
      .refine((value) => {
        const digits = value.replace(/\D/g, "");
        return digits.length >= 8 && digits.length <= 16;
      }, "Phone number is invalid"),
    address: z.string().trim().min(8),
    notes: z.string().optional(),
  }),
  paymentMethod: z.enum(["COD", "STRIPE"]),
  items: z.array(createOrderItemSchema).min(1),
  couponCode: z.string().trim().min(1).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ClientRegistrationInput = z.infer<typeof clientRegistrationSchema>;
export type ClientRegistrationVerifyInput = z.infer<typeof clientRegistrationVerifySchema>;
export type ClientRegistrationResendInput = z.infer<typeof clientRegistrationResendSchema>;
export type LoginAdminInput = z.infer<typeof loginAdminSchema>;
export type ForgotPasswordAdminInput = z.infer<
  typeof forgotPasswordAdminSchema
>;
export type ResetPasswordAdminInput = z.infer<typeof resetPasswordAdminSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export * from "./reviews.js";

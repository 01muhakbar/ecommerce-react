import { z } from "zod";
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["pembeli", "penjual"]>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name: string;
    role?: "pembeli" | "penjual" | undefined;
}, {
    email: string;
    password: string;
    name: string;
    role?: "pembeli" | "penjual" | undefined;
}>;
export declare const loginAdminSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const forgotPasswordAdminSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordAdminSchema: z.ZodObject<{
    password: z.ZodString;
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
export declare const updateProfileSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
}, {
    name?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
}>;
export declare const createProductSchema: z.ZodObject<{
    name: z.ZodString;
    price: z.ZodNumber;
    description: z.ZodString;
    stock: z.ZodNumber;
    categoryId: z.ZodNumber;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    price: number;
    description: string;
    stock: number;
    categoryId: number;
    images?: string[] | undefined;
}, {
    name: string;
    price: number;
    description: string;
    stock: number;
    categoryId: number;
    images?: string[] | undefined;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginAdminInput = z.infer<typeof loginAdminSchema>;
export type ForgotPasswordAdminInput = z.infer<typeof forgotPasswordAdminSchema>;
export type ResetPasswordAdminInput = z.infer<typeof resetPasswordAdminSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;

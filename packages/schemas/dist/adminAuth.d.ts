import { z } from 'zod';
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
export declare const createAdminSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name: string;
    role: string;
}, {
    email: string;
    password: string;
    name: string;
    role?: string | undefined;
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
}, "strip", z.ZodTypeAny, {
    password: string;
}, {
    password: string;
}>;
export type LoginAdminInput = z.infer<typeof loginAdminSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type ForgotPasswordAdminInput = z.infer<typeof forgotPasswordAdminSchema>;
export type ResetPasswordAdminInput = z.infer<typeof resetPasswordAdminSchema>;

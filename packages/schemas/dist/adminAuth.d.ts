import { z } from 'zod';
export declare const loginAdminSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const createAdminSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const forgotPasswordAdminSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const resetPasswordAdminSchema: z.ZodObject<{
    password: z.ZodString;
}, z.core.$strip>;
export type LoginAdminInput = z.infer<typeof loginAdminSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type ForgotPasswordAdminInput = z.infer<typeof forgotPasswordAdminSchema>;
export type ResetPasswordAdminInput = z.infer<typeof resetPasswordAdminSchema>;

import type {
  AdminForgotPasswordInput,
  AdminResendVerificationInput,
  AdminResetPasswordInput,
  AdminStaffSignupInput,
} from "@ecommerce/schemas";
import { api } from "./axios";

export const registerAdminStaffAccount = async (payload: AdminStaffSignupInput) => {
  const response = await api.post("/auth/admin/register", payload, {
    withCredentials: true,
  });
  return response.data;
};

export const verifyAdminStaffAccount = async (token: string) => {
  const response = await api.get("/auth/admin/verify-email", {
    params: { token },
    withCredentials: true,
  });
  return response.data;
};

export const resendAdminStaffVerification = async (payload: AdminResendVerificationInput) => {
  const response = await api.post("/auth/admin/register/resend-verification", payload, {
    withCredentials: true,
  });
  return response.data;
};

export const requestAdminPasswordReset = async (payload: AdminForgotPasswordInput) => {
  const response = await api.post("/auth/admin/forgot-password", payload, {
    withCredentials: true,
  });
  return response.data;
};

export const confirmAdminPasswordReset = async (payload: AdminResetPasswordInput) => {
  const response = await api.post("/auth/admin/reset-password", payload, {
    withCredentials: true,
  });
  return response.data;
};

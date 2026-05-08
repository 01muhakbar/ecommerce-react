import { api } from "./axios";

export const registerClientAccount = async (payload: Record<string, any>) => {
  const response = await api.post("/auth/register", payload, { withCredentials: true });
  return response.data;
};

export const resendClientRegistrationOtp = async (verificationId: string) => {
  const response = await api.post(
    "/auth/register/resend-otp",
    { verificationId },
    { withCredentials: true }
  );
  return response.data;
};

export const verifyClientRegistrationOtp = async (payload: {
  verificationId: string;
  otpCode: string;
}) => {
  const response = await api.post("/auth/register/verify-otp", payload, {
    withCredentials: true,
  });
  return response.data;
};

export const requestClientPasswordReset = async (payload: {
  email: string;
  honeypot?: string;
  startedAt: number;
}) => {
  const response = await api.post("/auth/forgot-password", payload, {
    withCredentials: true,
  });
  return response.data;
};

export const confirmClientPasswordReset = async (payload: {
  token: string;
  password: string;
  passwordConfirm: string;
  honeypot?: string;
  startedAt: number;
}) => {
  const response = await api.post("/auth/reset-password", payload, {
    withCredentials: true,
  });
  return response.data;
};

// server/src/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import * as models from "../models/index.js";
import {
  adminForgotPasswordSchema,
  adminResendVerificationSchema,
  adminResetPasswordSchema,
  adminStaffSignupSchema,
  clientRegistrationResendSchema,
  clientRegistrationSchema,
  clientRegistrationVerifySchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@ecommerce/schemas";
import requireAuth from "../middleware/requireAuth.js";
import {
  AdminPublicAuthError,
  registerAdminStaffSelfSignup,
  requestAdminVerificationResend,
  requestAdminPasswordReset,
  resetAdminPassword,
  verifyAdminStaffSignup,
} from "../services/adminPublicAuth.service.js";
import {
  ClientRegistrationError,
  ensureClientUserActivationConsistency,
  ensurePendingVerificationForLogin,
  isPendingClientUser,
  registerClientAccount,
  resendClientRegistrationOtp,
  verifyClientRegistrationOtp,
} from "../services/clientRegistration.service.js";
import {
  ClientPasswordResetError,
  requestClientPasswordReset,
  resetClientPassword,
} from "../services/clientPasswordReset.service.js";
import { AuthRateLimitError, enforceAuthRateLimit } from "../services/authRateLimit.service.js";
import { buildAuthSessionClaims } from "../services/authSession.service.js";

const { User } = models as { User?: any };
const AUTH_DEBUG_COOKIES = process.env.AUTH_DEBUG_COOKIES === "true";

const router = Router();

const resolveAuthCookieOptions = (req: any) => {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    (process.env.NODE_ENV === "production" && req.secure);
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    path: "/",
  };
};

const toAuthUser = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  avatarUrl: user.avatarUrl ?? null,
  phoneNumber: user.phoneNumber ?? null,
  status: user.status ?? null,
});

const isAdminWorkspaceRole = (role: unknown) =>
  ["staff", "admin", "super_admin", "superadmin"].includes(
    String(role || "").trim().toLowerCase()
  );

const issueAuthSession = async (req: any, res: any, user: any) => {
  const secret: string = process.env.JWT_SECRET ?? "dev-secret";
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? "1h") as any;
  const options: SignOptions = { expiresIn };
  const claims = await buildAuthSessionClaims(user);
  const token = jwt.sign(claims, secret, options);
  const cookieName = process.env.AUTH_COOKIE_NAME || "token";
  res.cookie(cookieName, token, resolveAuthCookieOptions(req));
  return token;
};

const getRequestContext = (req: any) => ({
  ipAddress:
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.ip ||
    "unknown",
  userAgent: String(req.headers["user-agent"] || ""),
});

const sendClientRegistrationError = (res: any, error: unknown) => {
  if (!(error instanceof ClientRegistrationError)) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
  return res.status(error.status).json({
    success: false,
    code: error.code,
    message: error.message,
    errors: error.errors ? { fieldErrors: error.errors } : undefined,
    data: error.data || undefined,
  });
};

const sendClientPasswordResetError = (res: any, error: unknown) => {
  if (!(error instanceof ClientPasswordResetError)) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
  return res.status(error.status).json({
    success: false,
    code: error.code,
    message: error.message,
    errors: error.errors ? { fieldErrors: error.errors } : undefined,
    data: error.data || undefined,
  });
};

const sendAdminPublicAuthError = (res: any, error: unknown) => {
  if (!(error instanceof AdminPublicAuthError)) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
  return res.status(error.status).json({
    success: false,
    code: error.code,
    message: error.message,
    errors: error.errors ? { fieldErrors: error.errors } : undefined,
    data: error.data || undefined,
  });
};

function logSetCookieDebug(res: any, label: string) {
  if (!AUTH_DEBUG_COOKIES) return;
  try {
    const hdr = res.getHeader?.("Set-Cookie");
    const arr = Array.isArray(hdr) ? hdr : hdr ? [hdr] : [];
    const cookieLines = arr.map((v: any) => String(v));
    const hasSecure = cookieLines.some((line) => /;\s*secure/i.test(line));
    console.log(
      `[auth][cookie] ${label} Set-Cookie count=${cookieLines.length} hasSecure=${hasSecure}`
    );
    const preview = cookieLines.map((line) =>
      line.replace(/^(token|[^=]+)=([^;]+)/i, "$1=<redacted>")
    );
    console.log(`[auth][cookie] ${label} preview=`, preview);
  } catch {
    console.log(`[auth][cookie] ${label} debug failed`);
  }
}

// Health
router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "auth" });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }

  if (!User) {
    return res.status(500).json({ success: false, message: "User model not loaded" });
  }

  const { email, password } = parsed.data;

  try {
    try {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const context = getRequestContext(req);
      enforceAuthRateLimit(`login:ip:${context.ipAddress}`, 12, 15 * 60 * 1000);
      enforceAuthRateLimit(`login:email:${normalizedEmail}`, 6, 15 * 60 * 1000);
    } catch (error) {
      if (error instanceof AuthRateLimitError) {
        return res.status(error.status).json({
          success: false,
          code: error.code,
          message: error.message,
          data: {
            retryAfterSeconds: error.retryAfterSeconds,
          },
        });
      }
      throw error;
    }

    const user = await User.findOne({ where: { email: String(email || "").trim().toLowerCase() } });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    await ensureClientUserActivationConsistency(user);

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (isPendingClientUser(user)) {
      const pendingVerification = await ensurePendingVerificationForLogin(String(user.email || ""));
      return res.status(403).json({
        success: false,
        code: "VERIFICATION_REQUIRED",
        message: "Verify your email before signing in.",
        data: pendingVerification || undefined,
      });
    }

    if (String(user.status || "").trim().toLowerCase() !== "active") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_NOT_ACTIVE",
        message: "Your account is not active.",
      });
    }

    await issueAuthSession(req, res, user);
    logSetCookieDebug(res, "login");

    return res.json({
      success: true,
      data: {
        user: toAuthUser(user),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/register", async (req, res) => {
  const parsed = clientRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    if (process.env.NODE_ENV === "development") {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid registration payload",
        errors: parsed.error.flatten(),
      });
    }
    return res.status(400).json({
      success: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid registration payload",
      errors: parsed.error.flatten(),
    });
  }

  if (!User) {
    return res.status(500).json({ success: false, message: "User model not loaded" });
  }

  try {
    const result = await registerClientAccount(parsed.data, getRequestContext(req));
    return res.status(202).json({
      success: true,
      data: {
        pendingRegistration: result.pending,
      },
      code: "VERIFICATION_REQUIRED",
      message: result.message,
    });
  } catch (error) {
    return sendClientRegistrationError(res, error);
  }
});

router.post("/register/resend-otp", async (req, res) => {
  const parsed = clientRegistrationResendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid verification request.",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const result = await resendClientRegistrationOtp(parsed.data, getRequestContext(req));
    return res.status(200).json({
      success: true,
      code: "VERIFICATION_REQUIRED",
      message: result.message,
      data: {
        pendingRegistration: result.pending,
      },
    });
  } catch (error) {
    return sendClientRegistrationError(res, error);
  }
});

router.post("/register/verify-otp", async (req, res) => {
  const parsed = clientRegistrationVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid verification request.",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const result = await verifyClientRegistrationOtp(parsed.data, getRequestContext(req));
    await issueAuthSession(req, res, result.user);
    logSetCookieDebug(res, "register_verify");
    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    return sendClientRegistrationError(res, error);
  }
});

router.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid password reset request.",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const result = await requestClientPasswordReset(parsed.data, getRequestContext(req));
    return res.status(202).json({
      success: true,
      code: "PASSWORD_RESET_REQUESTED",
      message: result.message,
    });
  } catch (error) {
    return sendClientPasswordResetError(res, error);
  }
});

router.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid password reset request.",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const result = await resetClientPassword(parsed.data, getRequestContext(req));
    return res.status(200).json({
      success: true,
      code: "PASSWORD_RESET_COMPLETED",
      message: result.message,
    });
  } catch (error) {
    return sendClientPasswordResetError(res, error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!User) {
    return res.status(500).json({ success: false, message: "User model not loaded" });
  }

  return User.findByPk(user.id, {
    attributes: ["id", "email", "name", "role", "avatarUrl", "phoneNumber", "status"],
  })
    .then((dbUser: any) => {
      if (!dbUser) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      return ensureClientUserActivationConsistency(dbUser)
        .then((normalizedUser: any) => {
          if (String(normalizedUser.status || "").trim().toLowerCase() !== "active") {
            return res.status(403).json({
              success: false,
              code: "ACCOUNT_NOT_ACTIVE",
              message: "Your account is not active.",
            });
          }
          return res.json({ success: true, data: { user: toAuthUser(normalizedUser) } });
        })
        .catch((error: any) => {
          console.error(error);
          return res.status(500).json({ success: false, message: "Internal server error" });
        });
    })
    .catch((error: any) => {
      console.error(error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    });
});

router.post("/logout", (req, res) => {
  const cookieName = process.env.AUTH_COOKIE_NAME || "token";
  res.clearCookie(cookieName, resolveAuthCookieOptions(req));
  return res.json({ success: true });
});

router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  if (!User) {
    return res.status(500).json({ message: "User model not loaded" });
  }

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!isAdminWorkspaceRole(user.role)) {
      return res.status(403).json({
        message: "This account does not have admin workspace access.",
      });
    }

    if (String(user.status || "").trim().toLowerCase() === "pending_verification") {
      return res.status(403).json({
        code: "VERIFICATION_REQUIRED",
        message: "Verify your email before signing in to Admin Workspace.",
      });
    }

    if (String(user.status || "").trim().toLowerCase() === "pending_approval") {
      return res.status(403).json({
        code: "APPROVAL_REQUIRED",
        message:
          "Your email is verified, but this Staff account is still waiting for Admin Workspace approval.",
      });
    }

    if (String(user.status || "").trim().toLowerCase() !== "active") {
      return res.status(403).json({
        code: "ACCOUNT_INACTIVE",
        message: "This account is inactive. Contact Admin Workspace to restore sign-in access.",
      });
    }

    await issueAuthSession(req, res, user);
    logSetCookieDebug(res, "admin_login");

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/logout", (req, res) => {
  const name = process.env.AUTH_COOKIE_NAME || "token";
  res.clearCookie(name, resolveAuthCookieOptions(req));
  res.status(204).end();
});

router.post("/admin/register", async (req, res) => {
  const parsed = adminStaffSignupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid registration payload.",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const result = await registerAdminStaffSelfSignup(parsed.data, getRequestContext(req));
    return res.status(202).json({
      success: true,
      code: "VERIFICATION_REQUIRED",
      message: result.message,
    });
  } catch (error) {
    return sendAdminPublicAuthError(res, error);
  }
});

router.post("/admin/register/resend-verification", async (req, res) => {
  const parsed = adminResendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid verification resend request.",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const result = await requestAdminVerificationResend(parsed.data, getRequestContext(req));
    return res.status(202).json({
      success: true,
      code: "VERIFICATION_REQUIRED",
      message: result.message,
    });
  } catch (error) {
    return sendAdminPublicAuthError(res, error);
  }
});

router.get("/admin/verify-email", async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) {
    return res.status(400).json({
      success: false,
      code: "VERIFY_TOKEN_INVALID",
      message:
        "This verification link is invalid or has expired. Create a new account or request another verification email.",
    });
  }

  try {
    const result = await verifyAdminStaffSignup(token, getRequestContext(req));
    return res.status(200).json({
      success: true,
      code: result.code || "EMAIL_VERIFIED",
      message: result.message,
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    return sendAdminPublicAuthError(res, error);
  }
});

router.post("/admin/forgot-password", async (req, res) => {
  const parsed = adminForgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid password reset request.",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const result = await requestAdminPasswordReset(parsed.data, getRequestContext(req));
    return res.status(202).json({
      success: true,
      code: "PASSWORD_RESET_REQUESTED",
      message: result.message,
    });
  } catch (error) {
    return sendAdminPublicAuthError(res, error);
  }
});

router.post("/admin/reset-password", async (req, res) => {
  const parsed = adminResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid password reset request.",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const result = await resetAdminPassword(parsed.data, getRequestContext(req));
    return res.status(200).json({
      success: true,
      code: "PASSWORD_RESET_COMPLETED",
      message: result.message,
    });
  } catch (error) {
    return sendAdminPublicAuthError(res, error);
  }
});

export default router;

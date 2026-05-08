import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import sendEmail from "../utils/email.js";
import { sequelize, User, UserRegistrationVerification } from "../models/index.js";
import { AuthRateLimitError, enforceAuthRateLimit } from "./authRateLimit.service.js";

const USER_STATUS_ACTIVE = "active";
const USER_STATUS_PENDING = "pending_verification";
const USER_STATUS_PENDING_APPROVAL = "pending_approval";
const VERIFICATION_STATUS_PENDING = "PENDING";
const VERIFICATION_STATUS_VERIFIED = "VERIFIED";
const VERIFICATION_STATUS_EXPIRED = "EXPIRED";
const VERIFICATION_STATUS_DELIVERY_FAILED = "DELIVERY_FAILED";
const ADMIN_SIGNUP_ROLE = "staff";
const ADMIN_VERIFY_PREFIX = "adminverify_";
const ADMIN_RESET_PREFIX = "adminpwdreset_";
const ADMIN_ALLOWED_RESET_ROLES = new Set(["staff", "admin", "super_admin", "superadmin"]);
const ADMIN_PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include at least 1 letter and 1 number.";
const GENERIC_ADMIN_RESET_MESSAGE =
  "If the email is registered, we have sent a password reset link.";
const GENERIC_ADMIN_RESEND_MESSAGE =
  "If the account is pending verification, we have sent another verification email.";
const ADMIN_VERIFY_INVALID_MESSAGE =
  "This verification link is invalid or has expired. Create a new account or request another verification email.";
const ADMIN_RESET_INVALID_MESSAGE =
  "This reset link is invalid or has expired. Request a new password reset email.";

const ADMIN_VERIFY_EXPIRY_MS = Number(process.env.ADMIN_VERIFY_EXPIRY_MS || 24 * 60 * 60 * 1000);
const ADMIN_VERIFY_MIN_SUBMIT_DELAY_MS = Number(
  process.env.ADMIN_VERIFY_MIN_SUBMIT_DELAY_MS || 4000
);
const ADMIN_VERIFY_RESEND_COOLDOWN_MS = Number(
  process.env.ADMIN_VERIFY_RESEND_COOLDOWN_MS || 60 * 1000
);
const ADMIN_RESET_EXPIRY_MS = Number(process.env.ADMIN_RESET_EXPIRY_MS || 60 * 60 * 1000);
const ADMIN_RESET_MIN_SUBMIT_DELAY_MS = Number(
  process.env.ADMIN_RESET_MIN_SUBMIT_DELAY_MS || 3000
);

type AuthContext = {
  ipAddress: string;
  userAgent: string;
};

type AdminSignupInput = {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  passwordConfirm: string;
  honeypot?: string;
  startedAt: number;
};

type ForgotPasswordInput = {
  email: string;
  honeypot?: string;
  startedAt: number;
};

type ResendVerificationInput = {
  email: string;
  honeypot?: string;
  startedAt: number;
};

type ResetPasswordInput = {
  token: string;
  password: string;
  passwordConfirm: string;
  honeypot?: string;
  startedAt: number;
};

export class AdminPublicAuthError extends Error {
  status: number;
  code: string;
  errors?: Record<string, string[]>;
  data?: Record<string, any>;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    errors?: Record<string, string[]>;
    data?: Record<string, any>;
  }) {
    super(input.message);
    this.status = input.status;
    this.code = input.code;
    this.errors = input.errors;
    this.data = input.data;
  }
}

function enforceRateLimit(key: string, limit: number, windowMs: number) {
  try {
    enforceAuthRateLimit(key, limit, windowMs);
  } catch (error) {
    if (error instanceof AuthRateLimitError) {
      throw new AdminPublicAuthError({
        status: error.status,
        code: error.code,
        message: error.message,
        data: {
          retryAfterSeconds: error.retryAfterSeconds,
        },
      });
    }
    throw error;
  }
}

function sanitizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function sanitizeEmail(value: unknown) {
  return sanitizeText(value).toLowerCase();
}

function normalizePhoneNumber(value: unknown) {
  const raw = sanitizeText(value).replace(/[^\d+]/g, "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 16) {
    throw new AdminPublicAuthError({
      status: 400,
      code: "INVALID_PHONE",
      message: "We could not process this request.",
      errors: {
        phoneNumber: ["Phone number is invalid."],
      },
    });
  }
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  return `+${digits}`;
}

function normalizeUserStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function assertSubmissionGuards(input: { honeypot?: string; startedAt: number }, minDelayMs: number) {
  if (String(input.honeypot || "").trim()) {
    throw new AdminPublicAuthError({
      status: 400,
      code: "REQUEST_REJECTED",
      message: "We could not process this request.",
    });
  }
  const startedAt = Number(input.startedAt || 0);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < minDelayMs) {
    throw new AdminPublicAuthError({
      status: 400,
      code: "REQUEST_REJECTED",
      message: "We could not process this request.",
    });
  }
}

function isStrongPassword(value: string) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function hashToken(token: string) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return crypto.createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

function createToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
  };
}

function buildAdminVerifyUrl(token: string) {
  const configured = String(process.env.ADMIN_VERIFY_URL || "").trim();
  if (configured) {
    if (configured.includes("{token}")) {
      return configured.replace("{token}", encodeURIComponent(token));
    }
    const separator = configured.includes("?") ? "&" : "?";
    return `${configured}${separator}token=${encodeURIComponent(token)}`;
  }

  const clientUrl = String(process.env.CLIENT_URL || "http://localhost:5173").trim();
  return `${clientUrl.replace(/\/+$/, "")}/admin/verify-account?token=${encodeURIComponent(token)}`;
}

function buildAdminResetUrl(token: string) {
  const configured = String(process.env.ADMIN_PASSWORD_RESET_URL || "").trim();
  if (configured) {
    if (configured.includes("{token}")) {
      return configured.replace("{token}", encodeURIComponent(token));
    }
    const separator = configured.includes("?") ? "&" : "?";
    return `${configured}${separator}token=${encodeURIComponent(token)}`;
  }

  const clientUrl = String(process.env.CLIENT_URL || "http://localhost:5173").trim();
  return `${clientUrl.replace(/\/+$/, "")}/admin/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendAdminVerificationEmail(input: {
  email: string;
  name: string;
  verifyUrl: string;
  expiresInHours: number;
}) {
  const subject = "Verify your Admin Workspace account";
  const text = [
    `Hi ${input.name || "there"},`,
    "",
    "Your Admin Workspace account is almost ready.",
    `Open this link to verify your email and activate the Staff account: ${input.verifyUrl}`,
    `This link expires in ${input.expiresInHours} hour(s) and can only be used once.`,
    "",
    "If you did not request this account, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hi ${input.name || "there"},</p>
      <p>Your Admin Workspace account is almost ready.</p>
      <p>
        <a
          href="${input.verifyUrl}"
          style="display: inline-block; padding: 10px 16px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;"
        >
          Verify email
        </a>
      </p>
      <p>Or copy this URL into your browser:</p>
      <p style="word-break: break-all;">${input.verifyUrl}</p>
      <p>This link expires in ${input.expiresInHours} hour(s) and can only be used once.</p>
      <p>If you did not request this account, you can ignore this email.</p>
    </div>
  `;

  await sendEmail({
    email: input.email,
    subject,
    text,
    html,
  });
}

async function sendAdminApprovalEmail(input: {
  email: string;
  name: string;
  loginUrl: string;
}) {
  const subject = "Your Admin Workspace account is approved";
  const text = [
    `Hi ${input.name || "there"},`,
    "",
    "Your Staff account has been approved by Admin Workspace.",
    `You can now sign in with your email at: ${input.loginUrl}`,
    `Login email: ${input.email}`,
    "",
    "Use the password you set during account registration.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hi ${input.name || "there"},</p>
      <p>Your Staff account has been approved by Admin Workspace.</p>
      <p>
        <a
          href="${input.loginUrl}"
          style="display: inline-block; padding: 10px 16px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;"
        >
          Sign in to Admin Workspace
        </a>
      </p>
      <p>Login email: <strong>${input.email}</strong></p>
      <p>Use the password you set during account registration.</p>
    </div>
  `;

  await sendEmail({
    email: input.email,
    subject,
    text,
    html,
  });
}

function buildAdminLoginUrl() {
  const configured = String(process.env.ADMIN_LOGIN_URL || "").trim();
  if (configured) return configured;
  const clientUrl = String(process.env.CLIENT_URL || "http://localhost:5173").trim();
  return `${clientUrl.replace(/\/+$/, "")}/admin/login`;
}

async function sendAdminPasswordResetEmail(input: {
  email: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const subject = "Reset your Admin Workspace password";
  const text = [
    `Hi ${input.name || "there"},`,
    "",
    "We received a request to reset your Admin Workspace password.",
    `Open this link to choose a new password: ${input.resetUrl}`,
    `This link expires in ${input.expiresInMinutes} minutes and can only be used once.`,
    "",
    "If you did not request this change, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hi ${input.name || "there"},</p>
      <p>We received a request to reset your Admin Workspace password.</p>
      <p>
        <a
          href="${input.resetUrl}"
          style="display: inline-block; padding: 10px 16px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;"
        >
          Reset password
        </a>
      </p>
      <p>Or copy this URL into your browser:</p>
      <p style="word-break: break-all;">${input.resetUrl}</p>
      <p>This link expires in ${input.expiresInMinutes} minutes and can only be used once.</p>
      <p>If you did not request this change, you can ignore this email.</p>
    </div>
  `;

  await sendEmail({
    email: input.email,
    subject,
    text,
    html,
  });
}

async function expireRecordIfNeeded(record: any) {
  if (!record) return record;
  const expiresAt = record?.otpExpiresAt ? new Date(record.otpExpiresAt) : null;
  const status = String(record?.status || "").toUpperCase();
  if (
    expiresAt &&
    expiresAt.getTime() <= Date.now() &&
    [VERIFICATION_STATUS_PENDING, VERIFICATION_STATUS_DELIVERY_FAILED].includes(status)
  ) {
    await record.update({
      status: VERIFICATION_STATUS_EXPIRED,
    });
    record.setDataValue("status", VERIFICATION_STATUS_EXPIRED);
  }
  return record;
}

async function findLatestRecordForUser(userId: number, prefix: string) {
  const record = await UserRegistrationVerification.findOne({
    where: {
      userId,
      publicId: {
        [Op.like]: `${prefix}%`,
      },
      status: {
        [Op.in]: [
          VERIFICATION_STATUS_PENDING,
          VERIFICATION_STATUS_EXPIRED,
          VERIFICATION_STATUS_DELIVERY_FAILED,
        ],
      },
    },
    order: [["updatedAt", "DESC"]],
  });
  return expireRecordIfNeeded(record);
}

async function findUsableRecordByToken(prefix: string, rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await UserRegistrationVerification.findOne({
    where: {
      publicId: {
        [Op.like]: `${prefix}%`,
      },
      otpHash: tokenHash,
      status: VERIFICATION_STATUS_PENDING,
      otpExpiresAt: {
        [Op.gt]: new Date(),
      },
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "email", "name", "status", "role", "password"],
      },
    ],
    order: [["updatedAt", "DESC"]],
  });
  return expireRecordIfNeeded(record);
}

async function issueRecordForUser(input: {
  user: any;
  prefix: string;
  expiryMs: number;
  resendCooldownMs: number;
}) {
  let record = await findLatestRecordForUser(Number(input.user.id), input.prefix);
  const now = new Date();
  const { rawToken, tokenHash } = createToken();
  const expiresAt = new Date(now.getTime() + input.expiryMs);
  const resendAvailableAt = new Date(now.getTime() + input.resendCooldownMs);

  if (!record) {
    record = await UserRegistrationVerification.create({
      userId: Number(input.user.id),
      publicId: `${input.prefix}${crypto.randomBytes(16).toString("hex")}`,
      channel: "EMAIL",
      status: VERIFICATION_STATUS_PENDING,
      otpHash: tokenHash,
      otpExpiresAt: expiresAt,
      resendAvailableAt,
      lastSentAt: now,
      attempts: 0,
      maxAttempts: 5,
      resendCount: 1,
      maxResends: 5,
      lastAttemptAt: null,
      blockedAt: null,
      consumedAt: null,
      verifiedAt: null,
      lastDeliveryError: null,
    });
  } else {
    await record.update({
      status: VERIFICATION_STATUS_PENDING,
      otpHash: tokenHash,
      otpExpiresAt: expiresAt,
      resendAvailableAt,
      lastSentAt: now,
      attempts: 0,
      lastAttemptAt: null,
      blockedAt: null,
      consumedAt: null,
      verifiedAt: null,
      lastDeliveryError: null,
      resendCount: Number(record.resendCount || 0) + 1,
    });
  }

  return { record, rawToken };
}

function serializeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    phoneNumber: user.phoneNumber ?? null,
    status: user.status,
  };
}

export async function registerAdminStaffSelfSignup(
  input: AdminSignupInput,
  context: AuthContext
) {
  assertSubmissionGuards(input, ADMIN_VERIFY_MIN_SUBMIT_DELAY_MS);

  const name = sanitizeText(input.name);
  const email = sanitizeEmail(input.email);
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const password = String(input.password || "");

  if (!isStrongPassword(password)) {
    throw new AdminPublicAuthError({
      status: 400,
      code: "INVALID_PASSWORD",
      message: ADMIN_PASSWORD_POLICY_MESSAGE,
      errors: {
        password: [ADMIN_PASSWORD_POLICY_MESSAGE],
      },
    });
  }

  enforceRateLimit(`admin-register:ip:${context.ipAddress}`, 12, 15 * 60 * 1000);
  enforceRateLimit(`admin-register:email:${email}`, 6, 15 * 60 * 1000);
  enforceRateLimit(`admin-register:phone:${phoneNumber}`, 6, 15 * 60 * 1000);

  let user = await User.findOne({ where: { email } });
  const existingByPhone = await User.findOne({ where: { phoneNumber } });
  const existingRole = normalizeRole(user?.role);
  const existingStatus = normalizeUserStatus(user?.status);

  if (user) {
    const isReusablePendingStaff =
      existingRole === ADMIN_SIGNUP_ROLE && existingStatus === USER_STATUS_PENDING;
    if (!isReusablePendingStaff) {
      throw new AdminPublicAuthError({
        status: 409,
        code: "CONTACT_UNAVAILABLE",
        message: "We could not process this request.",
        errors: {
          email: ["This email is unavailable."],
        },
      });
    }
  }

  if (
    existingByPhone &&
    (!user || Number(existingByPhone.get("id")) !== Number(user.get("id")))
  ) {
    throw new AdminPublicAuthError({
      status: 409,
      code: "CONTACT_UNAVAILABLE",
      message: "We could not process this request.",
      errors: {
        phoneNumber: ["This phone number is unavailable."],
      },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  if (!user) {
    user = await sequelize.transaction(async (transaction) =>
      User.create(
        {
          name,
          email,
          phoneNumber,
          password: passwordHash,
          role: ADMIN_SIGNUP_ROLE,
          status: USER_STATUS_PENDING,
        } as any,
        { transaction }
      )
    );
  } else {
    await user.update({
      name,
      phoneNumber,
      password: passwordHash,
      role: ADMIN_SIGNUP_ROLE,
      status: USER_STATUS_PENDING,
    } as any);
  }

  const existingRecord = await findLatestRecordForUser(Number(user.id), ADMIN_VERIFY_PREFIX);
  const resendAvailableAt = existingRecord?.resendAvailableAt
    ? new Date(existingRecord.resendAvailableAt)
    : null;
  const canResend = !existingRecord || !resendAvailableAt || resendAvailableAt.getTime() <= Date.now();

  if (!canResend) {
    return {
      message:
        "Check your email to verify your staff account. After verification, Admin Workspace will review and approve your sign-in access.",
    };
  }

  const { record, rawToken } = await issueRecordForUser({
    user,
    prefix: ADMIN_VERIFY_PREFIX,
    expiryMs: ADMIN_VERIFY_EXPIRY_MS,
    resendCooldownMs: ADMIN_VERIFY_RESEND_COOLDOWN_MS,
  });

  try {
    await sendAdminVerificationEmail({
      email: String(user.email || ""),
      name: String(user.name || "").trim() || "there",
      verifyUrl: buildAdminVerifyUrl(rawToken),
      expiresInHours: Math.max(1, Math.round(ADMIN_VERIFY_EXPIRY_MS / 3600000)),
    });
    await record.update({
      status: VERIFICATION_STATUS_PENDING,
      lastDeliveryError: null,
    });
  } catch (error) {
    console.error("[auth/admin/register] email delivery failed", error);
    await record.update({
      status: VERIFICATION_STATUS_DELIVERY_FAILED,
      lastDeliveryError: String((error as Error)?.message || "Email delivery failed"),
    });
    throw new AdminPublicAuthError({
      status: 503,
      code: "VERIFICATION_DELIVERY_FAILED",
      message:
        "Your staff account is pending verification, but we could not send the email right now.",
    });
  }

  return {
    message:
      "Check your email to verify your staff account. After verification, Admin Workspace will review and approve your sign-in access.",
  };
}

export async function verifyAdminStaffSignup(rawToken: string, context: AuthContext) {
  const token = sanitizeText(rawToken);
  enforceRateLimit(`admin-verify:ip:${context.ipAddress}`, 20, 15 * 60 * 1000);
  enforceRateLimit(`admin-verify:token:${hashToken(token).slice(0, 24)}`, 8, 15 * 60 * 1000);

  const record = await findUsableRecordByToken(ADMIN_VERIFY_PREFIX, token);
  const user = record?.user ?? null;
  if (!record || !user) {
    throw new AdminPublicAuthError({
      status: 400,
      code: "VERIFY_TOKEN_INVALID",
      message: ADMIN_VERIFY_INVALID_MESSAGE,
      errors: {
        token: [ADMIN_VERIFY_INVALID_MESSAGE],
      },
    });
  }

  if (normalizeRole(user.role) !== ADMIN_SIGNUP_ROLE) {
    throw new AdminPublicAuthError({
      status: 403,
      code: "ROLE_NOT_ELIGIBLE",
      message: ADMIN_VERIFY_INVALID_MESSAGE,
    });
  }

  await sequelize.transaction(async (transaction) => {
    await user.update(
      {
        status: USER_STATUS_PENDING_APPROVAL,
        role: ADMIN_SIGNUP_ROLE,
      } as any,
      { transaction }
    );
    await record.update(
      {
        status: VERIFICATION_STATUS_VERIFIED,
        verifiedAt: new Date(),
        consumedAt: new Date(),
        otpExpiresAt: new Date(),
      },
      { transaction }
    );
  });

  return {
    code: "APPROVAL_PENDING",
    message:
      "Email verified. Your Staff account is now waiting for Admin Workspace approval before you can sign in.",
    user: serializeUser(user),
  };
}

export async function requestAdminVerificationResend(
  input: ResendVerificationInput,
  context: AuthContext
) {
  assertSubmissionGuards(input, ADMIN_VERIFY_MIN_SUBMIT_DELAY_MS);

  const email = sanitizeEmail(input.email);
  enforceRateLimit(`admin-register-resend:ip:${context.ipAddress}`, 12, 60 * 60 * 1000);
  enforceRateLimit(`admin-register-resend:email:${email}`, 5, 60 * 60 * 1000);

  const user = await User.findOne({
    where: { email },
    attributes: ["id", "email", "name", "status", "role"],
  });

  const role = normalizeRole(user?.role);
  const status = normalizeUserStatus(user?.status);
  if (!user || role !== ADMIN_SIGNUP_ROLE || status !== USER_STATUS_PENDING) {
    return {
      message: GENERIC_ADMIN_RESEND_MESSAGE,
    };
  }

  const existingRecord = await findLatestRecordForUser(Number(user.id), ADMIN_VERIFY_PREFIX);
  const resendAvailableAt = existingRecord?.resendAvailableAt
    ? new Date(existingRecord.resendAvailableAt)
    : null;
  const canResend =
    !existingRecord || !resendAvailableAt || resendAvailableAt.getTime() <= Date.now();

  if (!canResend) {
    return {
      message: GENERIC_ADMIN_RESEND_MESSAGE,
    };
  }

  const { record, rawToken } = await issueRecordForUser({
    user,
    prefix: ADMIN_VERIFY_PREFIX,
    expiryMs: ADMIN_VERIFY_EXPIRY_MS,
    resendCooldownMs: ADMIN_VERIFY_RESEND_COOLDOWN_MS,
  });

  try {
    await sendAdminVerificationEmail({
      email: String(user.email || ""),
      name: String(user.name || "").trim() || "there",
      verifyUrl: buildAdminVerifyUrl(rawToken),
      expiresInHours: Math.max(1, Math.round(ADMIN_VERIFY_EXPIRY_MS / 3600000)),
    });
    await record.update({
      status: VERIFICATION_STATUS_PENDING,
      lastDeliveryError: null,
    });
  } catch (error) {
    console.error("[auth/admin/register/resend-verification] email delivery failed", error);
    await record.update({
      status: VERIFICATION_STATUS_DELIVERY_FAILED,
      lastDeliveryError: String((error as Error)?.message || "Email delivery failed"),
    });
  }

  return {
    message: GENERIC_ADMIN_RESEND_MESSAGE,
  };
}

export async function requestAdminPasswordReset(
  input: ForgotPasswordInput,
  context: AuthContext
) {
  assertSubmissionGuards(input, ADMIN_RESET_MIN_SUBMIT_DELAY_MS);

  const email = sanitizeEmail(input.email);
  enforceRateLimit(`admin-password-reset:request:ip:${context.ipAddress}`, 12, 60 * 60 * 1000);
  enforceRateLimit(`admin-password-reset:request:email:${email}`, 5, 60 * 60 * 1000);

  const user = await User.findOne({
    where: { email },
    attributes: ["id", "email", "name", "status", "role"],
  });

  const role = normalizeRole(user?.role);
  const status = normalizeUserStatus(user?.status);
  if (!user || !ADMIN_ALLOWED_RESET_ROLES.has(role) || status !== USER_STATUS_ACTIVE) {
    return {
      message: GENERIC_ADMIN_RESET_MESSAGE,
    };
  }

  const { record, rawToken } = await issueRecordForUser({
    user,
    prefix: ADMIN_RESET_PREFIX,
    expiryMs: ADMIN_RESET_EXPIRY_MS,
    resendCooldownMs: ADMIN_VERIFY_RESEND_COOLDOWN_MS,
  });

  try {
    await sendAdminPasswordResetEmail({
      email: String(user.email || ""),
      name: String(user.name || "").trim() || "there",
      resetUrl: buildAdminResetUrl(rawToken),
      expiresInMinutes: Math.max(1, Math.round(ADMIN_RESET_EXPIRY_MS / 60000)),
    });
    await record.update({
      status: VERIFICATION_STATUS_PENDING,
      lastDeliveryError: null,
    });
  } catch (error) {
    console.error("[auth/admin/forgot-password] email delivery failed", error);
    await record.update({
      status: VERIFICATION_STATUS_DELIVERY_FAILED,
      lastDeliveryError: String((error as Error)?.message || "Email delivery failed"),
    });
  }

  return {
    message: GENERIC_ADMIN_RESET_MESSAGE,
  };
}

export async function resetAdminPassword(input: ResetPasswordInput, context: AuthContext) {
  assertSubmissionGuards(input, ADMIN_RESET_MIN_SUBMIT_DELAY_MS);

  const token = sanitizeText(input.token);
  const password = String(input.password || "");
  if (!isStrongPassword(password)) {
    throw new AdminPublicAuthError({
      status: 400,
      code: "INVALID_PASSWORD",
      message: ADMIN_PASSWORD_POLICY_MESSAGE,
      errors: {
        password: [ADMIN_PASSWORD_POLICY_MESSAGE],
      },
    });
  }

  enforceRateLimit(`admin-password-reset:confirm:ip:${context.ipAddress}`, 20, 15 * 60 * 1000);
  enforceRateLimit(
    `admin-password-reset:confirm:token:${hashToken(token).slice(0, 24)}`,
    8,
    15 * 60 * 1000
  );

  const record = await findUsableRecordByToken(ADMIN_RESET_PREFIX, token);
  const user = record?.user ?? null;
  if (!record || !user) {
    throw new AdminPublicAuthError({
      status: 400,
      code: "RESET_TOKEN_INVALID",
      message: ADMIN_RESET_INVALID_MESSAGE,
      errors: {
        token: [ADMIN_RESET_INVALID_MESSAGE],
      },
    });
  }

  const role = normalizeRole(user.role);
  const status = normalizeUserStatus(user.status);
  if (!ADMIN_ALLOWED_RESET_ROLES.has(role) || status !== USER_STATUS_ACTIVE) {
    throw new AdminPublicAuthError({
      status: 403,
      code: "ACCOUNT_INACTIVE",
      message:
        "This account is inactive. Contact Admin Workspace to restore access before resetting the password.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await sequelize.transaction(async (transaction) => {
    await user.update({ password: passwordHash }, { transaction });
    await record.update(
      {
        status: VERIFICATION_STATUS_VERIFIED,
        verifiedAt: new Date(),
        consumedAt: new Date(),
        otpExpiresAt: new Date(),
      },
      { transaction }
    );
  });

  return {
    message: "Password reset complete. Sign in to Admin Workspace with your new password.",
  };
}

export async function approveAdminPendingStaffAccount(input: {
  userId: number;
  actorName?: string | null;
}) {
  const user = await User.findByPk(Number(input.userId), {
    attributes: ["id", "email", "name", "status", "role"],
  });

  if (!user) {
    throw new AdminPublicAuthError({
      status: 404,
      code: "ACCOUNT_NOT_FOUND",
      message: "Staff account not found.",
    });
  }

  if (normalizeRole(user.role) !== ADMIN_SIGNUP_ROLE) {
    throw new AdminPublicAuthError({
      status: 409,
      code: "ACCOUNT_NOT_ELIGIBLE",
      message: "Only pending Staff self-signup accounts can be approved from this flow.",
    });
  }

  if (normalizeUserStatus(user.status) !== USER_STATUS_PENDING_APPROVAL) {
    throw new AdminPublicAuthError({
      status: 409,
      code: "ACCOUNT_NOT_PENDING_APPROVAL",
      message: "This staff account is not waiting for approval.",
    });
  }

  await user.update({
    status: USER_STATUS_ACTIVE,
  } as any);

  let approvalEmailSent = true;
  try {
    await sendAdminApprovalEmail({
      email: String(user.email || "").trim(),
      name: String(user.name || "").trim() || "there",
      loginUrl: buildAdminLoginUrl(),
    });
  } catch (error) {
    approvalEmailSent = false;
    console.error("[auth/admin/approve-staff] email delivery failed", error);
  }

  return {
    message: approvalEmailSent
      ? `Staff account approved. ${String(user.email || "").trim()} can now sign in at /admin/login using the registered email.`
      : `Staff account approved, but the approval email could not be sent right now. Ask ${String(user.email || "").trim()} to sign in at /admin/login using the registered email.`,
    approvalEmailSent,
    user: serializeUser(user),
  };
}

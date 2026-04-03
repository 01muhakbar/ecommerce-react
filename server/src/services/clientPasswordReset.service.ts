import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import sendEmail from "../utils/email.js";
import { sequelize, User, UserRegistrationVerification } from "../models/index.js";
import { ensureClientUserActivationConsistency } from "./clientRegistration.service.js";
import { AuthRateLimitError, enforceAuthRateLimit } from "./authRateLimit.service.js";

const PASSWORD_RESET_EXPIRY_MS = Number(
  process.env.CLIENT_PASSWORD_RESET_EXPIRY_MS || 60 * 60 * 1000
);
const PASSWORD_RESET_MIN_SUBMIT_DELAY_MS = Number(
  process.env.CLIENT_PASSWORD_RESET_MIN_SUBMIT_DELAY_MS || 3000
);
const PASSWORD_RESET_RESEND_COOLDOWN_MS = Number(
  process.env.CLIENT_PASSWORD_RESET_RESEND_COOLDOWN_MS || 60 * 1000
);
const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If the email is registered, we have sent a password reset link.";
const DEFAULT_RESET_ERROR_MESSAGE =
  "This reset link is invalid or has expired. Request a new password reset email.";

const VERIFICATION_STATUS_PENDING = "PENDING";
const VERIFICATION_STATUS_VERIFIED = "VERIFIED";
const VERIFICATION_STATUS_EXPIRED = "EXPIRED";
const VERIFICATION_STATUS_DELIVERY_FAILED = "DELIVERY_FAILED";

type PasswordResetContext = {
  ipAddress: string;
  userAgent: string;
};

type ForgotPasswordInput = {
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

export class ClientPasswordResetError extends Error {
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
      throw new ClientPasswordResetError({
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

function assertSubmissionGuards(input: { honeypot?: string; startedAt: number }) {
  if (String(input.honeypot || "").trim()) {
    throw new ClientPasswordResetError({
      status: 400,
      code: "REQUEST_REJECTED",
      message: "We could not process this request.",
    });
  }
  const startedAt = Number(input.startedAt || 0);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < PASSWORD_RESET_MIN_SUBMIT_DELAY_MS) {
    throw new ClientPasswordResetError({
      status: 400,
      code: "REQUEST_REJECTED",
      message: "We could not process this request.",
    });
  }
}

function hashResetToken(token: string) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return crypto.createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

function createResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
  };
}

export function buildClientPasswordResetUrl(token: string) {
  const configured = String(process.env.CLIENT_PASSWORD_RESET_URL || "").trim();
  if (configured) {
    if (configured.includes("{token}")) {
      return configured.replace("{token}", encodeURIComponent(token));
    }
    const separator = configured.includes("?") ? "&" : "?";
    return `${configured}${separator}token=${encodeURIComponent(token)}`;
  }

  const clientUrl = String(process.env.CLIENT_URL || "http://localhost:5173").trim();
  return `${clientUrl.replace(/\/+$/, "")}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail(input: {
  email: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
  sendEmailFn?: typeof sendEmail;
}) {
  const subject = "Reset your password";
  const text = [
    `Hi ${input.name || "there"},`,
    "",
    "We received a request to reset the password for your account.",
    `Open this link to choose a new password: ${input.resetUrl}`,
    `This link expires in ${input.expiresInMinutes} minutes and can only be used once.`,
    "",
    "If you did not request this change, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hi ${input.name || "there"},</p>
      <p>We received a request to reset the password for your account.</p>
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

  await (input.sendEmailFn || sendEmail)({
    email: input.email,
    subject,
    text,
    html,
  });
}

function normalizeUserStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function expirePasswordResetIfNeeded(record: any) {
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

async function findLatestPasswordResetRecordForUser(userId: number) {
  const record = await UserRegistrationVerification.findOne({
    where: {
      userId,
      publicId: {
        [Op.like]: "pwdreset_%",
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
  return expirePasswordResetIfNeeded(record);
}

async function findUsablePasswordResetRecordByToken(rawToken: string) {
  const tokenHash = hashResetToken(rawToken);
  const record = await UserRegistrationVerification.findOne({
    where: {
      publicId: {
        [Op.like]: "pwdreset_%",
      },
      otpHash: tokenHash,
      status: VERIFICATION_STATUS_PENDING,
      otpExpiresAt: {
        [Op.gt]: new Date(),
      },
    },
    include: [{ model: User, as: "user", attributes: ["id", "email", "name", "status", "password"] }],
    order: [["updatedAt", "DESC"]],
  });
  return expirePasswordResetIfNeeded(record);
}

async function issuePasswordResetRecord(user: any) {
  let record = await findLatestPasswordResetRecordForUser(Number(user.id));
  const now = new Date();
  const { rawToken, tokenHash } = createResetToken();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_EXPIRY_MS);
  const resendAvailableAt = new Date(now.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS);

  if (!record) {
    record = await UserRegistrationVerification.create({
      userId: Number(user.id),
      publicId: `pwdreset_${crypto.randomBytes(16).toString("hex")}`,
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

  return {
    record,
    rawToken,
  };
}

export async function requestClientPasswordReset(
  input: ForgotPasswordInput,
  context: PasswordResetContext,
  options?: {
    sendEmailFn?: typeof sendEmail;
  }
) {
  assertSubmissionGuards(input);

  const email = sanitizeEmail(input.email);
  enforceRateLimit(`password-reset:request:ip:${context.ipAddress}`, 12, 60 * 60 * 1000);
  enforceRateLimit(`password-reset:request:email:${email}`, 5, 60 * 60 * 1000);

  const user = await User.findOne({
    where: { email },
    attributes: ["id", "email", "name", "status"],
  });
  await ensureClientUserActivationConsistency(user);

  const status = normalizeUserStatus(user?.status);
  if (!user || status !== "active") {
    return {
      message: GENERIC_FORGOT_PASSWORD_MESSAGE,
    };
  }

  const { record, rawToken } = await issuePasswordResetRecord(user);
  try {
    await sendPasswordResetEmail({
      email: String(user.email || ""),
      name: String(user.name || "").trim() || "there",
      resetUrl: buildClientPasswordResetUrl(rawToken),
      expiresInMinutes: Math.max(1, Math.round(PASSWORD_RESET_EXPIRY_MS / 60000)),
      sendEmailFn: options?.sendEmailFn,
    });
    await record.update({
      status: VERIFICATION_STATUS_PENDING,
      lastDeliveryError: null,
    });
  } catch (error) {
    console.error("[auth/forgot-password] email delivery failed", error);
    await record.update({
      status: VERIFICATION_STATUS_DELIVERY_FAILED,
      lastDeliveryError: String((error as Error)?.message || "Email delivery failed"),
    });
  }

  return {
    message: GENERIC_FORGOT_PASSWORD_MESSAGE,
  };
}

export async function resetClientPassword(
  input: ResetPasswordInput,
  context: PasswordResetContext
) {
  assertSubmissionGuards(input);

  const rawToken = sanitizeText(input.token);
  enforceRateLimit(`password-reset:confirm:ip:${context.ipAddress}`, 20, 15 * 60 * 1000);
  enforceRateLimit(
    `password-reset:confirm:token:${hashResetToken(rawToken).slice(0, 24)}`,
    8,
    15 * 60 * 1000
  );

  const record = await findUsablePasswordResetRecordByToken(rawToken);
  const user = record?.user ?? null;
  await ensureClientUserActivationConsistency(user);
  if (!record || !user) {
    throw new ClientPasswordResetError({
      status: 400,
      code: "RESET_TOKEN_INVALID",
      message: DEFAULT_RESET_ERROR_MESSAGE,
      errors: {
        token: [DEFAULT_RESET_ERROR_MESSAGE],
      },
    });
  }

  const status = normalizeUserStatus(user.status);
  if (status !== "active") {
    throw new ClientPasswordResetError({
      status: 403,
      code: "ACCOUNT_NOT_ACTIVE",
      message: "This account is not eligible for password reset right now.",
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
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
    message: "Your password has been reset. Sign in with your new password.",
  };
}

import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import sendEmail from "../utils/email.js";
import { sequelize, User, UserRegistrationVerification } from "../models/index.js";

const USER_STATUS_ACTIVE = "active";
const USER_STATUS_PENDING = "pending_verification";
const VERIFICATION_CHANNEL = "EMAIL";
const VERIFICATION_STATUS_PENDING = "PENDING";
const VERIFICATION_STATUS_VERIFIED = "VERIFIED";
const VERIFICATION_STATUS_EXPIRED = "EXPIRED";
const VERIFICATION_STATUS_BLOCKED = "BLOCKED";
const VERIFICATION_STATUS_DELIVERY_FAILED = "DELIVERY_FAILED";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = Number(process.env.CLIENT_REGISTRATION_OTP_EXPIRY_MS || 10 * 60 * 1000);
const OTP_RESEND_COOLDOWN_MS = Number(
  process.env.CLIENT_REGISTRATION_OTP_RESEND_COOLDOWN_MS || 60 * 1000
);
const OTP_MAX_ATTEMPTS = Number(process.env.CLIENT_REGISTRATION_OTP_MAX_ATTEMPTS || 5);
const OTP_MAX_RESENDS = Number(process.env.CLIENT_REGISTRATION_OTP_MAX_RESENDS || 5);
const MIN_SUBMIT_DELAY_MS = Number(process.env.CLIENT_REGISTRATION_MIN_SUBMIT_DELAY_MS || 4000);

const rateLimitBuckets = new Map<string, number[]>();

type RegisterInput = {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  passwordConfirm: string;
  termsAccepted: boolean;
  honeypot?: string;
  startedAt: number;
};

type VerificationInput = {
  verificationId: string;
  otpCode: string;
};

type ResendInput = {
  verificationId: string;
};

type RegistrationContext = {
  ipAddress: string;
  userAgent: string;
};

type VerificationSummary = {
  registrationStatus: "PENDING_VERIFICATION";
  channel: "EMAIL";
  destinationMasked: string;
  verificationId: string;
  deliveryStatus: "SENT" | "FAILED";
  canSubmitOtp: boolean;
  expiresAt: string | null;
  expiresInSeconds: number;
  resendAvailableAt: string | null;
  resendAvailableInSeconds: number;
};

type PendingRegistrationResponse = {
  registration: {
    status: "PENDING_VERIFICATION";
    email: string;
    phoneNumber: string;
  };
  verification: VerificationSummary;
};

type RegisterResult = {
  message: string;
  pending: PendingRegistrationResponse;
  sent: boolean;
};

type ResendResult = {
  message: string;
  pending: PendingRegistrationResponse;
  sent: boolean;
};

type VerifyResult = {
  message: string;
  user: any;
};

export class ClientRegistrationError extends Error {
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

function pushRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(key) || []).filter((value) => now - value < windowMs);
  if (timestamps.length >= limit) {
    const retryAfterMs = Math.max(windowMs - (now - timestamps[0]), 1000);
    rateLimitBuckets.set(key, timestamps);
    return {
      limited: true,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }
  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);
  return {
    limited: false,
    retryAfterSeconds: 0,
  };
}

function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const result = pushRateLimit(key, limit, windowMs);
  if (result.limited) {
    throw new ClientRegistrationError({
      status: 429,
      code: "RATE_LIMITED",
      message: "Please wait before trying again.",
      data: {
        retryAfterSeconds: result.retryAfterSeconds,
      },
    });
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
    throw new ClientRegistrationError({
      status: 400,
      code: "INVALID_PHONE",
      message: "We could not process this registration request.",
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

function maskEmail(value: string) {
  const [localPart, domainPart = ""] = String(value || "").split("@");
  const maskedLocal =
    localPart.length <= 2 ? `${localPart.slice(0, 1)}*` : `${localPart.slice(0, 2)}***`;
  const domainSegments = domainPart.split(".");
  const domainName = domainSegments[0] || "";
  const domainSuffix = domainSegments.slice(1).join(".");
  const maskedDomain =
    domainName.length <= 1 ? "*" : `${domainName.slice(0, 1)}***${domainSuffix ? `.${domainSuffix}` : ""}`;
  return `${maskedLocal}@${maskedDomain}`;
}

function createOtpCode() {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

function hashOtpCode(verificationId: string, otpCode: string) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return crypto
    .createHash("sha256")
    .update(`${secret}:${verificationId}:${String(otpCode || "").trim()}`)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getFutureIso(date: Date | null) {
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function buildVerificationSummary(verification: any, user: any): VerificationSummary {
  const now = Date.now();
  const otpExpiresAt = verification?.otpExpiresAt ? new Date(verification.otpExpiresAt) : null;
  const resendAvailableAt = verification?.resendAvailableAt
    ? new Date(verification.resendAvailableAt)
    : null;
  const verificationStatus = String(verification?.status || "").toUpperCase();
  const isCodeDeliverable = verificationStatus === VERIFICATION_STATUS_PENDING;
  const expiresInSeconds = otpExpiresAt
    ? Math.max(0, Math.ceil((otpExpiresAt.getTime() - now) / 1000))
    : 0;

  return {
    registrationStatus: "PENDING_VERIFICATION",
    channel: "EMAIL",
    destinationMasked: maskEmail(String(user?.email || "")),
    verificationId: String(verification?.publicId || ""),
    deliveryStatus: isCodeDeliverable ? "SENT" : "FAILED",
    canSubmitOtp: isCodeDeliverable && expiresInSeconds > 0,
    expiresAt: getFutureIso(otpExpiresAt),
    expiresInSeconds,
    resendAvailableAt: getFutureIso(resendAvailableAt),
    resendAvailableInSeconds: resendAvailableAt
      ? Math.max(0, Math.ceil((resendAvailableAt.getTime() - now) / 1000))
      : 0,
  };
}

function buildPendingResponse(user: any, verification: any): PendingRegistrationResponse {
  return {
    registration: {
      status: "PENDING_VERIFICATION",
      email: maskEmail(String(user?.email || "")),
      phoneNumber: String(user?.phoneNumber || ""),
    },
    verification: buildVerificationSummary(verification, user),
  };
}

async function sendRegistrationOtpEmail(input: {
  email: string;
  name: string;
  otpCode: string;
  expiresInMinutes: number;
}) {
  const subject = "Your verification code";
  const text = [
    `Hi ${input.name || "there"},`,
    "",
    `Use this verification code to activate your account: ${input.otpCode}`,
    `This code expires in ${input.expiresInMinutes} minutes.`,
    "",
    "If you did not request this registration, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <p>Hi ${input.name || "there"},</p>
      <p>Use this verification code to activate your account:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${input.otpCode}</p>
      <p>This code expires in ${input.expiresInMinutes} minutes.</p>
      <p>If you did not request this registration, you can ignore this email.</p>
    </div>
  `;

  await sendEmail({
    email: input.email,
    subject,
    text,
    html,
  });
}

function normalizeUserStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function findRegistrationVerificationByPublicId(publicId: string) {
  return UserRegistrationVerification.findOne({
    where: { publicId },
    include: [{ model: User, as: "user", attributes: ["id", "name", "email", "phoneNumber", "status"] }],
  });
}

async function findLatestOpenVerificationForUser(userId: number) {
  return UserRegistrationVerification.findOne({
    where: {
      userId,
      status: {
        [Op.in]: [
          VERIFICATION_STATUS_PENDING,
          VERIFICATION_STATUS_EXPIRED,
          VERIFICATION_STATUS_BLOCKED,
          VERIFICATION_STATUS_DELIVERY_FAILED,
        ],
      },
    },
    order: [["updatedAt", "DESC"]],
  });
}

async function expireVerificationIfNeeded(verification: any) {
  if (!verification) return verification;
  const status = String(verification.status || "").toUpperCase();
  const expiresAt = verification.otpExpiresAt ? new Date(verification.otpExpiresAt) : null;
  if (
    expiresAt &&
    expiresAt.getTime() <= Date.now() &&
    [VERIFICATION_STATUS_PENDING, VERIFICATION_STATUS_DELIVERY_FAILED].includes(status)
  ) {
    await verification.update({
      status: VERIFICATION_STATUS_EXPIRED,
    });
    verification.setDataValue("status", VERIFICATION_STATUS_EXPIRED);
  }
  return verification;
}

async function issueVerificationCode(
  verification: any,
  user: any,
  options: { isResend: boolean }
) {
  const now = new Date();
  const otpCode = createOtpCode();
  const nextExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
  const nextResendAvailableAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS);
  const nextResendCount = options.isResend ? Number(verification.resendCount || 0) + 1 : Number(verification.resendCount || 0);

  if (options.isResend && nextResendCount > Number(verification.maxResends || OTP_MAX_RESENDS)) {
    throw new ClientRegistrationError({
      status: 429,
      code: "OTP_RESEND_LIMIT",
      message: "Please wait before requesting another code.",
      data: {
        pending: buildPendingResponse(user, verification),
      },
    });
  }

  await verification.update({
    status: VERIFICATION_STATUS_PENDING,
    otpHash: hashOtpCode(String(verification.publicId || ""), otpCode),
    otpExpiresAt: nextExpiresAt,
    resendAvailableAt: nextResendAvailableAt,
    lastSentAt: now,
    attempts: 0,
    lastAttemptAt: null,
    blockedAt: null,
    consumedAt: null,
    verifiedAt: null,
    lastDeliveryError: null,
    resendCount: nextResendCount,
  });

  try {
    await sendRegistrationOtpEmail({
      email: String(user.email || ""),
      name: String(user.name || "").trim() || "there",
      otpCode,
      expiresInMinutes: Math.max(1, Math.round(OTP_EXPIRY_MS / 60000)),
    });
    return {
      sent: true,
      verification,
    };
  } catch (error) {
    await verification.update({
      status: VERIFICATION_STATUS_DELIVERY_FAILED,
      lastDeliveryError: String((error as Error)?.message || "Email delivery failed"),
    });
    verification.setDataValue("status", VERIFICATION_STATUS_DELIVERY_FAILED);
    return {
      sent: false,
      verification,
    };
  }
}

async function ensurePendingVerificationForUser(
  user: any,
  options: { sendIfAllowed: boolean; isResend: boolean }
) {
  let verification = await findLatestOpenVerificationForUser(Number(user.id));
  if (!verification) {
    const now = new Date();
    const publicId = crypto.randomBytes(18).toString("hex");
    verification = await UserRegistrationVerification.create({
      userId: Number(user.id),
      publicId,
      channel: VERIFICATION_CHANNEL,
      status: VERIFICATION_STATUS_PENDING,
      otpHash: hashOtpCode(publicId, "000000"),
      otpExpiresAt: new Date(now.getTime() - 1000),
      resendAvailableAt: now,
      lastSentAt: null,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      resendCount: 0,
      maxResends: OTP_MAX_RESENDS,
    });
  }

  await expireVerificationIfNeeded(verification);

  if (!options.sendIfAllowed) {
    return {
      sent: false,
      verification,
    };
  }

  const resendAvailableAt = verification.resendAvailableAt
    ? new Date(verification.resendAvailableAt)
    : null;
  if (
    verification.lastSentAt &&
    resendAvailableAt &&
    resendAvailableAt.getTime() > Date.now()
  ) {
    return {
      sent: false,
      verification,
    };
  }

  return issueVerificationCode(verification, user, { isResend: options.isResend });
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

async function rejectIfSuspicious(input: RegisterInput, context: RegistrationContext) {
  if (String(input.honeypot || "").trim()) {
    throw new ClientRegistrationError({
      status: 400,
      code: "REQUEST_REJECTED",
      message: "We could not process this registration request.",
    });
  }

  if (!Number.isFinite(Number(input.startedAt))) {
    throw new ClientRegistrationError({
      status: 400,
      code: "REQUEST_REJECTED",
      message: "We could not process this registration request.",
    });
  }

  const elapsedMs = Date.now() - Number(input.startedAt);
  if (elapsedMs < MIN_SUBMIT_DELAY_MS) {
    throw new ClientRegistrationError({
      status: 400,
      code: "REQUEST_REJECTED",
      message: "We could not process this registration request.",
    });
  }

  enforceRateLimit(`register:ip:${context.ipAddress}`, 12, 15 * 60 * 1000);
}

export async function registerClientAccount(
  input: RegisterInput,
  context: RegistrationContext
): Promise<RegisterResult> {
  await rejectIfSuspicious(input, context);

  const name = sanitizeText(input.name);
  const email = sanitizeEmail(input.email);
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);

  enforceRateLimit(`register:email:${email}`, 6, 15 * 60 * 1000);
  enforceRateLimit(`register:phone:${phoneNumber}`, 6, 15 * 60 * 1000);

  const existingByEmail = await User.findOne({ where: { email } });
  const existingByPhone = await User.findOne({ where: { phoneNumber } });

  if (existingByEmail && normalizeUserStatus(existingByEmail.get("status")) === USER_STATUS_ACTIVE) {
    throw new ClientRegistrationError({
      status: 409,
      code: "CONTACT_UNAVAILABLE",
      message: "We could not process this registration request.",
      errors: {
        email: ["This email is unavailable."],
      },
    });
  }

  if (
    existingByPhone &&
    (!existingByEmail || Number(existingByPhone.get("id")) !== Number(existingByEmail.get("id"))) &&
    normalizeUserStatus(existingByPhone.get("status")) === USER_STATUS_ACTIVE
  ) {
    throw new ClientRegistrationError({
      status: 409,
      code: "CONTACT_UNAVAILABLE",
      message: "We could not process this registration request.",
      errors: {
        phoneNumber: ["This phone number is unavailable."],
      },
    });
  }

  let user = existingByEmail;
  if (user && normalizeUserStatus(user.get("status")) !== USER_STATUS_PENDING) {
    throw new ClientRegistrationError({
      status: 409,
      code: "CONTACT_UNAVAILABLE",
      message: "We could not process this registration request.",
      errors: {
        email: ["This email is unavailable."],
      },
    });
  }

  if (
    existingByPhone &&
    (!user || Number(existingByPhone.get("id")) !== Number(user.get("id")))
  ) {
    throw new ClientRegistrationError({
      status: 409,
      code: "CONTACT_UNAVAILABLE",
      message: "We could not process this registration request.",
      errors: {
        phoneNumber: ["This phone number is unavailable."],
      },
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  if (!user) {
    user = await sequelize.transaction(async (transaction) =>
      User.create(
        {
          name,
          email,
          phoneNumber,
          password: passwordHash,
          role: "customer",
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
      status: USER_STATUS_PENDING,
    } as any);
  }

  const pendingOutcome = await ensurePendingVerificationForUser(user, {
    sendIfAllowed: true,
    isResend: false,
  });
  const pending = buildPendingResponse(user, pendingOutcome.verification);

  if (!pendingOutcome.sent && String(pendingOutcome.verification.status || "") === VERIFICATION_STATUS_DELIVERY_FAILED) {
    throw new ClientRegistrationError({
      status: 503,
      code: "OTP_DELIVERY_FAILED",
      message: "Your account is pending verification, but we could not send the code right now.",
      data: {
        pending,
      },
    });
  }

  if (!pendingOutcome.sent) {
    return {
      message: "Your account is still pending verification. Check your email or request a new code later.",
      pending,
      sent: false,
    };
  }

  return {
    message: "Verification code sent to your email.",
    pending,
    sent: true,
  };
}

export async function resendClientRegistrationOtp(
  input: ResendInput,
  context: RegistrationContext
): Promise<ResendResult> {
  const verificationId = sanitizeText(input.verificationId);
  enforceRateLimit(`resend:ip:${context.ipAddress}`, 12, 60 * 60 * 1000);
  enforceRateLimit(`resend:verification:${verificationId}`, 8, 60 * 60 * 1000);

  const verification = await findRegistrationVerificationByPublicId(verificationId);
  const user = verification?.get("user");
  if (!verification || !user) {
    throw new ClientRegistrationError({
      status: 400,
      code: "OTP_INVALID_OR_EXPIRED",
      message: "The verification code is invalid or expired.",
    });
  }

  if (normalizeUserStatus((user as any).status) === USER_STATUS_ACTIVE) {
    throw new ClientRegistrationError({
      status: 409,
      code: "ALREADY_VERIFIED",
      message: "This account is already active.",
    });
  }

  await expireVerificationIfNeeded(verification);

  const resendAvailableAt = verification.resendAvailableAt
    ? new Date(verification.resendAvailableAt)
    : null;
  if (
    verification.lastSentAt &&
    resendAvailableAt &&
    resendAvailableAt.getTime() > Date.now()
  ) {
    throw new ClientRegistrationError({
      status: 429,
      code: "OTP_RESEND_COOLDOWN",
      message: "Please wait before requesting another code.",
      data: {
        pending: buildPendingResponse(user, verification),
      },
    });
  }

  const result = await issueVerificationCode(verification, user, { isResend: true });
  const pending = buildPendingResponse(user, result.verification);

  if (!result.sent) {
    throw new ClientRegistrationError({
      status: 503,
      code: "OTP_DELIVERY_FAILED",
      message: "We could not send a new verification code right now.",
      data: {
        pending,
      },
    });
  }

  return {
    message: "A new verification code was sent to your email.",
    pending,
    sent: true,
  };
}

export async function verifyClientRegistrationOtp(
  input: VerificationInput,
  context: RegistrationContext
): Promise<VerifyResult> {
  const verificationId = sanitizeText(input.verificationId);
  const otpCode = sanitizeText(input.otpCode);

  enforceRateLimit(`verify:ip:${context.ipAddress}`, 20, 15 * 60 * 1000);
  enforceRateLimit(`verify:verification:${verificationId}`, 12, 15 * 60 * 1000);

  const verification = await findRegistrationVerificationByPublicId(verificationId);
  const user = verification?.get("user");
  if (!verification || !user) {
    throw new ClientRegistrationError({
      status: 400,
      code: "OTP_INVALID_OR_EXPIRED",
      message: "The verification code is invalid or expired.",
    });
  }

  if (normalizeUserStatus((user as any).status) === USER_STATUS_ACTIVE) {
    throw new ClientRegistrationError({
      status: 409,
      code: "ALREADY_VERIFIED",
      message: "This account is already active.",
    });
  }

  await expireVerificationIfNeeded(verification);
  const status = String(verification.status || "").toUpperCase();
  if (status === VERIFICATION_STATUS_EXPIRED || status === VERIFICATION_STATUS_DELIVERY_FAILED) {
    throw new ClientRegistrationError({
      status: 400,
      code: "OTP_INVALID_OR_EXPIRED",
      message: "The verification code is invalid or expired.",
      data: {
        pending: buildPendingResponse(user, verification),
      },
    });
  }

  if (status === VERIFICATION_STATUS_BLOCKED) {
    throw new ClientRegistrationError({
      status: 429,
      code: "OTP_ATTEMPTS_EXCEEDED",
      message: "Too many attempts. Request a new code.",
      data: {
        pending: buildPendingResponse(user, verification),
      },
    });
  }

  const now = new Date();
  const expectedHash = String(verification.otpHash || "");
  const providedHash = hashOtpCode(verificationId, otpCode);
  const isValid = safeEqual(expectedHash, providedHash);

  if (!isValid) {
    const nextAttempts = Number(verification.attempts || 0) + 1;
    const nextStatus =
      nextAttempts >= Number(verification.maxAttempts || OTP_MAX_ATTEMPTS)
        ? VERIFICATION_STATUS_BLOCKED
        : VERIFICATION_STATUS_PENDING;
    await verification.update({
      attempts: nextAttempts,
      lastAttemptAt: now,
      status: nextStatus,
      blockedAt: nextStatus === VERIFICATION_STATUS_BLOCKED ? now : null,
    });
    throw new ClientRegistrationError({
      status: nextStatus === VERIFICATION_STATUS_BLOCKED ? 429 : 400,
      code:
        nextStatus === VERIFICATION_STATUS_BLOCKED
          ? "OTP_ATTEMPTS_EXCEEDED"
          : "OTP_INVALID_OR_EXPIRED",
      message:
        nextStatus === VERIFICATION_STATUS_BLOCKED
          ? "Too many attempts. Request a new code."
          : "The verification code is invalid or expired.",
      data: {
        pending: buildPendingResponse(user, verification),
      },
    });
  }

  await sequelize.transaction(async (transaction) => {
    await verification.update(
      {
        status: VERIFICATION_STATUS_VERIFIED,
        verifiedAt: now,
        consumedAt: now,
        lastAttemptAt: now,
      },
      { transaction }
    );
    await (user as any).update(
      {
        status: USER_STATUS_ACTIVE,
      },
      { transaction }
    );
  });

  return {
    message: "Email verified. Your account is now active.",
    user: serializeUser(user),
  };
}

export async function ensurePendingVerificationForLogin(email: string) {
  const user = await User.findOne({ where: { email } });
  if (!user || normalizeUserStatus(user.get("status")) !== USER_STATUS_PENDING) {
    return null;
  }
  const result = await ensurePendingVerificationForUser(user, {
    sendIfAllowed: true,
    isResend: false,
  });
  return {
    pending: buildPendingResponse(user, result.verification),
    sent: result.sent,
  };
}

export function isPendingClientUser(user: any) {
  return normalizeUserStatus(user?.status) === USER_STATUS_PENDING;
}

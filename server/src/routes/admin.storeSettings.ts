import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Router, Request, Response } from "express";
import {
  buildStoreSettingsContracts,
  ensureSettingsTable,
  getPersistedStoreSettings,
  mergeStoreSettingsForUpdate,
  sanitizeStoreSettings,
  upsertStoreSettings,
} from "../services/storeSettings.js";

const router = Router();

const BRANDING_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "branding");
const BRANDING_UPLOAD_LIMIT_BYTES = 1024 * 1024;
const BRANDING_TARGET_FIELD_BY_KEY = {
  client: "clientLogoUrl",
  admin: "adminLogoUrl",
  seller: "sellerLogoUrl",
  "admin-login-hero": "adminLoginHeroUrl",
  "admin-forgot-password-hero": "adminForgotPasswordHeroUrl",
  "admin-create-account-hero": "adminCreateAccountHeroUrl",
} as const;

type BrandingTarget = keyof typeof BRANDING_TARGET_FIELD_BY_KEY;

const normalizeBrandingTarget = (value: unknown): BrandingTarget | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "client" ||
    normalized === "admin" ||
    normalized === "seller" ||
    normalized === "admin-login-hero" ||
    normalized === "admin-forgot-password-hero" ||
    normalized === "admin-create-account-hero"
  ) {
    return normalized;
  }
  return null;
};

fs.mkdirSync(BRANDING_UPLOAD_DIR, { recursive: true });

const brandingLogoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BRANDING_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const target = normalizeBrandingTarget(req.params?.target) || "client";
      const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
      const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
      const fileName = `branding-${target}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}${safeExt}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const acceptedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!acceptedMimeTypes.has(String(file.mimetype || "").toLowerCase())) {
      cb(new Error("Only PNG, JPEG, and WEBP images are allowed."));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: BRANDING_UPLOAD_LIMIT_BYTES,
  },
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    await ensureSettingsTable();
    const persisted = await getPersistedStoreSettings();
    const contract = buildStoreSettingsContracts(persisted);
    return res.json({
      success: true,
      data: {
        storeSettings: contract.admin.storeSettings,
        diagnostics: contract.admin.diagnostics,
      },
    });
  } catch (error) {
    console.error("[admin.storeSettings][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch store settings." });
  }
});

router.put("/", async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payload: body must be an object.",
    });
  }

  try {
    await ensureSettingsTable();
    const existing = await getPersistedStoreSettings();
    const incomingRaw =
      req.body && typeof req.body.storeSettings === "object" && !Array.isArray(req.body.storeSettings)
        ? req.body.storeSettings
        : req.body;
    const storeSettings = mergeStoreSettingsForUpdate(existing, incomingRaw);
    await upsertStoreSettings(storeSettings);

    const contract = buildStoreSettingsContracts(storeSettings);
    return res.json({
      success: true,
      data: {
        storeSettings: contract.admin.storeSettings,
        diagnostics: contract.admin.diagnostics,
      },
    });
  } catch (error) {
    console.error("[admin.storeSettings][PUT] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update store settings." });
  }
});

router.post("/branding/:target/logo", (req: Request, res: Response, next) => {
  brandingLogoUpload.single("file")(req, res, async (error: any) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to upload branding logo.",
      });
    }

    const target = normalizeBrandingTarget(req.params?.target);
    if (!target) {
      return res.status(400).json({
        success: false,
        message: "Invalid branding target.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    try {
      await ensureSettingsTable();
      const existing = await getPersistedStoreSettings();
      const brandingField = BRANDING_TARGET_FIELD_BY_KEY[target];
      const uploadedLogoUrl = `/uploads/branding/${req.file.filename}`;
      const storeSettings = sanitizeStoreSettings({
        ...existing,
        branding: {
          ...existing.branding,
          [brandingField]: uploadedLogoUrl,
        },
      });

      await upsertStoreSettings(storeSettings);
      const contract = buildStoreSettingsContracts(storeSettings);

      return res.json({
        success: true,
        data: {
          target,
          logoUrl: uploadedLogoUrl,
          branding: contract.admin.storeSettings.branding,
          storeSettings: contract.admin.storeSettings,
          diagnostics: contract.admin.diagnostics,
        },
      });
    } catch (uploadPersistError) {
      return next(uploadPersistError);
    }
  });
});

export default router;

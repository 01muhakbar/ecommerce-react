import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { requireStaffOrAdmin } from "../middleware/requireRole.js";
import { getAdminMe, updateAdminMe } from "../controllers/admin/adminProfileController.js";

const router = Router();

const uploadDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
      cb(new Error("Only .jpeg, .png, and .webp files are allowed."));
      return;
    }
    cb(null, true);
  },
});

router.get("/me", getAdminMe);
router.put("/me", updateAdminMe);

router.post("/uploads", requireStaffOrAdmin, (req, res) => {
  upload.single("file")(req, res, (error: any) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image too large (max 2MB)." });
      }
      return res.status(400).json({
        message: error?.message || "Invalid upload payload.",
      });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const url = `/uploads/${req.file.filename}`;
    return res.json({ url });
  });
});

export default router;

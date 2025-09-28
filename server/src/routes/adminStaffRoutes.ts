import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createStaff, listStaff, updateStatus, updatePublishedStatus, getStaff, updateStaff, deleteStaff, changePassword } from "../controllers/adminStaffController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads/staff");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = Date.now() + "-" + Math.random().toString(36).slice(2) + ext;
    cb(null, safe);
  }
});
const fileFilter: multer.Options["fileFilter"] = (_, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Invalid file type"), ok);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB

const r = Router();
const adminOnly = restrictTo("Admin", "Super Admin");

r.get("/", listStaff);
r.post("/", protect, adminOnly, upload.single("image"), createStaff);
r.patch("/:id/status", protect, adminOnly, updateStatus);
r.patch("/:id/published", protect, adminOnly, updatePublishedStatus);
r.get("/:id", protect, adminOnly, getStaff);
r.patch("/:id", protect, adminOnly, upload.single("image"), updateStaff);
r.delete("/:id", protect, adminOnly, deleteStaff);
r.patch("/:id/password", protect, adminOnly, changePassword);

export default r;

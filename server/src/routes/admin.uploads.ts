import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { requireStaffOrAdmin } from "../middleware/requireRole.js";

const router = Router();

const uploadDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

router.post("/uploads", requireStaffOrAdmin, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const url = `/uploads/${req.file.filename}`;
  return res.json({ url });
});

export default router;

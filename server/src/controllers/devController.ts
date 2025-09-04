import { Request, Response, NextFunction } from "express";
import db from "../models";

/**
 * Sinkronisasi database dengan model Sequelize.
 * Hanya dapat diakses di lingkungan non-produksi.
 * GET /api/v1/dev/sync-database
 */
export const syncDatabase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Keamanan: Pastikan endpoint ini tidak bisa diakses di produksi
  if (process.env.NODE_ENV === "production") {
    return res
      .status(403)
      .json({ message: "This endpoint is not available in production." });
  }

  try {
    const force = req.query.force === "true";
    const alter = req.query.alter === "true";
    const syncOptions = force ? { force: true } : alter ? { alter: true } : {};

    if (force || alter) {
      await db.sequelize.sync(syncOptions);
    }

    const syncMode = force ? "force: true" : alter ? "alter: true" : "no-op";
    res.status(200).json({
      message: `Database synchronized successfully. Mode: ${syncMode}`,
    });
  } catch (error) {
    console.error("Database sync error:", error);
    next(error); // Teruskan ke global error handler
  }
};

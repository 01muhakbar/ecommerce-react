import express, { Request, Response, NextFunction } from "express";
// We import a model (e.g., User) to get access to the shared sequelize instance.
import { User } from "../models/User.js";

/**
 * Synchronizes the database.
 * Use query params `?force=true` or `?alter=true`.
 */
export const syncDatabase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const force = req.query.force === "true";
    const alter = req.query.alter === "true";
    const syncOptions = force ? { force: true } : alter ? { alter: true } : {};

    if (force || alter) {
      // Access the sequelize instance from any imported model
      await User.sequelize.sync(syncOptions);
    }

    const syncMode = force ? "force: true" : alter ? "alter: true" : "no-op";
    res.status(200).json({
      message: `Database synchronized successfully. Mode: ${syncMode}`,
    });
  } catch (error) {
    console.error("Database sync error:", error);
    next(error);
  }
};

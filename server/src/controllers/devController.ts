import express, { Request, Response, NextFunction } from "express";
import { sequelize } from "../models/index.js";

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
      await sequelize.sync(syncOptions as any);
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



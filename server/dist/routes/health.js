import { Router } from "express";
import sequelize from "../config/database.js";
const router = Router();
router.get("/health", async (_req, res) => {
    const uptime = Math.floor(process.uptime());
    let db = "disconnected";
    try {
        await sequelize.authenticate();
        db = "connected";
    }
    catch {
        db = "disconnected";
    }
    res.json({
        ok: true,
        uptime,
        db,
        timestamp: new Date().toISOString(),
    });
});
export default router;

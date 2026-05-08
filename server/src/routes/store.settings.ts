import { Router } from "express";
import {
  buildStoreSettingsContracts,
  ensureSettingsTable,
  getPersistedStoreSettings,
} from "../services/storeSettings.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    await ensureSettingsTable();
    const persisted = await getPersistedStoreSettings();
    const contract = buildStoreSettingsContracts(persisted);
    return res.json({
      success: true,
      data: {
        storeSettings: contract.public.storeSettings,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

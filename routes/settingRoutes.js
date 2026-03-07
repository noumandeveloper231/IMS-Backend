import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import { getSettings, updateSettings } from "../controllers/settingController.js";

const router = express.Router();

router.get("/get", protect, allow("settings.manage"), getSettings);
router.put("/update", protect, allow("settings.manage"), updateSettings);

export default router;

import express from "express";
import { getSettings, updateSettings } from "../controllers/settingController.js";

const router = express.Router();

router.get("/get", getSettings);
router.put("/update", updateSettings);

export default router;

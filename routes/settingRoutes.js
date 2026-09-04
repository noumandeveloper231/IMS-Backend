import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  getSettings,
  updateSettings,
  uploadSiteIcon,
  uploadSiteLogo,
  uploadPlaceholderImage,
} from "../controllers/settingController.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

router.get("/get", protect, getSettings);
router.put("/update", protect, allow("settings.manage"), updateSettings);

router.post(
  "/upload-site-icon",
  protect,
  allow("settings.manage"),
  upload.single("image"),
  uploadSiteIcon,
);
router.post(
  "/upload-site-logo",
  protect,
  allow("settings.manage"),
  upload.single("image"),
  uploadSiteLogo,
);
router.post(
  "/upload-placeholder-image",
  protect,
  allow("settings.manage"),
  upload.single("image"),
  uploadPlaceholderImage,
);

export default router;

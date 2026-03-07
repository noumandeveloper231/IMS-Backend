import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/upload.js";
import {
  uploadMedia,
  getMedia,
  getMediaById,
  deleteMedia,
} from "../controllers/mediaController.js";

const router = express.Router();

router.post("/upload", protect, allow("media.upload"), upload.array("images", 20), uploadMedia);
router.get("/", protect, allow("media.read"), getMedia);
router.get("/:id", protect, allow("media.read"), getMediaById);
router.delete("/:id", protect, allow("media.delete"), deleteMedia);

export default router;

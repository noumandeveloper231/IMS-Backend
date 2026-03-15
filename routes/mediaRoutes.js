import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/upload.js";
import {
  uploadMedia,
  bulkCreateMedia,
  getMedia,
  getMediaById,
  deleteMedia,
  getFolders,
  createFolder,
  updateMedia,
  moveMediaToFolder,
  copyMediaToFolder,
  deleteFolder,
} from "../controllers/mediaController.js";

const router = express.Router();

router.get("/folders", protect, allow("media.read"), getFolders);
router.post("/folders", protect, allow("media.upload"), createFolder);
router.delete("/folders/delete", protect, allow("media.delete"), deleteFolder);
router.post("/move", protect, allow("media.upload"), moveMediaToFolder);
router.post("/copy", protect, allow("media.upload"), copyMediaToFolder);
router.patch("/:id", protect, allow("media.upload"), updateMedia);
router.post("/upload", protect, allow("media.upload"), upload.array("images", 20), uploadMedia);
router.post("/bulk", protect, allow("media.upload"), bulkCreateMedia);
router.get("/", protect, allow("media.read"), getMedia);
router.get("/:id", protect, allow("media.read"), getMediaById);
router.delete("/:id", protect, allow("media.delete"), deleteMedia);

export default router;

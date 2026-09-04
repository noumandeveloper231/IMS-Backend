import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import { downloadImage } from "../controllers/imageController.js";

const router = express.Router();

router.get("/download", protect, allow("media.read"), downloadImage);

export default router;

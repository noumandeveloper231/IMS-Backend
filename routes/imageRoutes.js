import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { downloadImage } from "../controllers/imageController.js";

const router = express.Router();

router.get("/download", protect, downloadImage);

export default router;

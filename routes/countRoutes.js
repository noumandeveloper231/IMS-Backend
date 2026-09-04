// routes/countRoutes.js
import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  getAllCounts,
  getStockCounts,
} from "../controllers/countController.js";

const router = express.Router();

router.get("/counts", protect, allow("report.read", "product.read"), getAllCounts);
router.get("/products/stock-counts", protect, allow("product.read"), getStockCounts);

export default router;

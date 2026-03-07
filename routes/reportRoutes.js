import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  getSalesReport,
  getProfitLossReport,
  getInventoryReport,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/sales", protect, allow("report.read"), getSalesReport);
router.get("/profit-loss", protect, allow("report.read"), getProfitLossReport);
router.get("/inventory", protect, allow("report.read"), getInventoryReport);

export default router;

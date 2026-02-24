import express from "express";
import {
  getSalesReport,
  getProfitLossReport,
  getInventoryReport,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/sales", getSalesReport);
router.get("/profit-loss", getProfitLossReport);
router.get("/inventory", getInventoryReport);

export default router;

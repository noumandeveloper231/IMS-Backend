// routes/countRoutes.js
import express from "express";
import {
  getAllCounts,
  getStockCounts,
} from "../controllers/countController.js";

const router = express.Router();

router.get("/counts", getAllCounts);
router.get("/products/stock-counts", getStockCounts);

export default router;

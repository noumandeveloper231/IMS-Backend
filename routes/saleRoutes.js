import express from "express";
import {
  createSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
  getInvoice,
  processRefund,
} from "../controllers/saleController.js";
import { createSaleValidation } from "../validators/saleValidators.js";
import { validate } from "../middlewares/validate.js";
import { protect, allow } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create", protect, allow("order.create"), createSaleValidation, validate, createSale);
router.get("/getall", protect, allow("order.read"), getSales);
router.get("/getone/:id", protect, allow("order.read"), getSaleById);
router.put("/update/:id", protect, allow("order.update"), updateSale);
router.delete("/delete/:id", protect, allow("order.update"), deleteSale);
router.get("/:id/invoice", protect, allow("order.read"), getInvoice);
router.post("/refund/:saleId", protect, allow("order.update"), processRefund);

export default router;

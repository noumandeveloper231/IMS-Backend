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

const router = express.Router();

router.post("/create", createSaleValidation, validate, createSale);
router.get("/getall", getSales);
router.get("/getone/:id", getSaleById);
router.put("/update/:id", updateSale);
router.delete("/delete/:id", deleteSale);
router.get("/:id/invoice", getInvoice);
router.post("/refund/:saleId", processRefund);

export default router;

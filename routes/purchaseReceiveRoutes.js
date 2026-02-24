// routes/purchaseReceiveRoutes.js
import express from "express";
import {
  createPurchaseReceive,
  getPurchaseOrdersByVendor,
  getPurchaseReceives,
  getPurchaseReceiveById,
  updatePurchaseReceive,
  deletePurchaseReceive,
} from "../controllers/purchaseReceiveController.js";

const router = express.Router();

router.post("/", createPurchaseReceive);
router.get("/", getPurchaseReceives);
router.get("/:id", getPurchaseReceiveById);
router.put("/:id", updatePurchaseReceive);
router.delete("/:id", deletePurchaseReceive);
router.get("/by-vendor/:vendorId", getPurchaseOrdersByVendor);

export default router;

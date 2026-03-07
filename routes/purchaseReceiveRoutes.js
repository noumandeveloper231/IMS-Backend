// routes/purchaseReceiveRoutes.js
import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createPurchaseReceive,
  getPurchaseOrdersByVendor,
  getPurchaseReceives,
  getPurchaseReceiveById,
  updatePurchaseReceive,
  deletePurchaseReceive,
} from "../controllers/purchaseReceiveController.js";

const router = express.Router();

router.post("/", protect, allow("purchase.manage"), createPurchaseReceive);
router.get("/", protect, allow("purchase.manage"), getPurchaseReceives);
router.get("/:id", protect, allow("purchase.manage"), getPurchaseReceiveById);
router.put("/:id", protect, allow("purchase.manage"), updatePurchaseReceive);
router.delete("/:id", protect, allow("purchase.manage"), deletePurchaseReceive);
router.get("/by-vendor/:vendorId", protect, allow("purchase.manage"), getPurchaseOrdersByVendor);

export default router;

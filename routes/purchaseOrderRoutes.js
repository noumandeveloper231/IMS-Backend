// routes/purchaseOrderRoutes.js
import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from "../controllers/purchaseOrderController.js";

const router = express.Router();

router.post("/", protect, allow("purchase.manage"), createPurchaseOrder);
router.get("/", protect, allow("purchase.manage"), getPurchaseOrders);
router.get("/:id", protect, allow("purchase.manage"), getPurchaseOrderById);
router.put("/:id", protect, allow("purchase.manage"), updatePurchaseOrder);
router.delete("/:id", protect, allow("purchase.manage"), deletePurchaseOrder);

export default router;

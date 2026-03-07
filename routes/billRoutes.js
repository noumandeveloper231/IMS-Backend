import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createBill,
  getBills,
  getBillById,
  updateBill,
  deleteBill,
} from "../controllers/billController.js";

const router = express.Router();

router.post("/", protect, allow("purchase.manage"), createBill);
router.get("/", protect, allow("purchase.manage"), getBills);
router.get("/:id", protect, allow("purchase.manage"), getBillById);
router.put("/:id", protect, allow("purchase.manage"), updateBill);
router.delete("/:id", protect, allow("purchase.manage"), deleteBill);

export default router;

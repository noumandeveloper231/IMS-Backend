// routes/vendorRoutes.js
import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createVendor,
  createBulkVendors,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
} from "../controllers/vendorController.js";

const router = express.Router();

router.post("/create", protect, allow("vendor.manage"), createVendor);
router.post("/createbulk", protect, allow("vendor.manage"), createBulkVendors);
router.get("/getall", protect, allow("vendor.manage"), getVendors);
router.get("/getone/:id", protect, allow("vendor.manage"), getVendorById);
router.put("/update/:id", protect, allow("vendor.manage"), updateVendor);
router.delete("/delete/:id", protect, allow("vendor.manage"), deleteVendor);

export default router;

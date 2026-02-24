// routes/vendorRoutes.js
import express from "express";
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
} from "../controllers/vendorController.js";

const router = express.Router();

// CRUD routes
router.post("/create", createVendor);
router.get("/getall", getVendors);
router.get("/getone/:id", getVendorById);
router.put("/update/:id", updateVendor);
router.delete("/delete/:id", deleteVendor);

export default router;

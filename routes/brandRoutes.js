// routes/brandRoutes.js
import express from "express";
import upload from "../middlewares/upload.js";
import {
  createBrand,
  createBulkBrands,
  getBrands,
  getBrandsCount,
  getBrandById,
  // getBrandsCountcart,
  updateBrand,
  deleteBrand,
} from "../controllers/brandController.js";

const router = express.Router();

// Public endpoints
router.post("/create", upload.single("image"), createBrand); // Create
router.post("/createbulk", createBulkBrands); // Bulk Create
router.get("/getall", getBrands); // List
router.get("/getallcount", getBrandsCount); // List
router.get("/getone/:id", getBrandById); // Read one
// router.get("/countcart", getBrandsCountcart);
router.put("/update/:id", upload.single("image"), updateBrand); // Update
router.delete("/delete/:id", deleteBrand); // Delete

export default router;

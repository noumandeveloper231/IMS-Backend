// routes/brandRoutes.js
import express from "express";
import upload from "../middlewares/upload.js";
import {
  createBrand,
  createBulkBrands,
  getBrands,
  getBrandsCount,
  getBrandById,
  updateBrand,
  deleteBrand,
  getBrandDependencies,
  transferBrandDependencies,
  uploadBrandImage,
  deleteBrandImageByUrl,
} from "../controllers/brandController.js";

const router = express.Router();

// Public endpoints
router.post("/create", upload.single("image"), createBrand); // Create
router.post("/upload-image", upload.single("image"), uploadBrandImage); // Upload image only
router.post("/delete-image-by-url", deleteBrandImageByUrl); // Delete blob image by URL (for import replace)
router.post("/createbulk", createBulkBrands); // Bulk Create
router.get("/getall", getBrands); // List
router.get("/getallcount", getBrandsCount); // List
router.get("/getone/:id", getBrandById); // Read one
router.get("/dependencies/:id", getBrandDependencies); // Get dependencies
router.post("/transfer/:id", transferBrandDependencies); // Transfer then delete
router.get("/transfer/:id", (req, res) =>
  res.status(405).json({ success: false, message: "Use POST to transfer dependencies." })
);
router.put("/update/:id", upload.single("image"), updateBrand); // Update
router.delete("/delete/:id", deleteBrand); // Delete

export default router;

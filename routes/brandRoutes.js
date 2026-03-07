// routes/brandRoutes.js
import express from "express";
import upload from "../middlewares/upload.js";
import { protect, allow } from "../middlewares/authMiddleware.js";
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
  checkBulkDependencies,
  bulkDeletePreview,
  bulkDelete,
} from "../controllers/brandController.js";

const router = express.Router();

router.post("/create", protect, allow("brand.manage"), upload.single("image"), createBrand);
router.post("/upload-image", protect, allow("brand.manage"), upload.single("image"), uploadBrandImage);
router.post("/delete-image-by-url", protect, allow("brand.manage"), deleteBrandImageByUrl);
router.post("/createbulk", protect, allow("brand.manage"), createBulkBrands);
router.get("/getall", protect, allow("brand.manage"), getBrands);
router.get("/getallcount", protect, allow("brand.manage"), getBrandsCount);
router.get("/getone/:id", protect, allow("brand.manage"), getBrandById);
router.get("/dependencies/:id", protect, allow("brand.manage"), getBrandDependencies);
router.post("/transfer/:id", protect, allow("brand.manage"), transferBrandDependencies);
router.get("/transfer/:id", (req, res) =>
  res.status(405).json({ success: false, message: "Use POST to transfer dependencies." })
);
router.post("/check-bulk-dependencies", protect, allow("brand.manage"), checkBulkDependencies);
router.post("/bulk-delete-preview", protect, allow("brand.manage"), bulkDeletePreview);
router.post("/bulk-delete", protect, allow("brand.manage"), bulkDelete);
router.put("/update/:id", protect, allow("brand.manage"), upload.single("image"), updateBrand);
router.delete("/delete/:id", protect, allow("brand.manage"), deleteBrand);

export default router;

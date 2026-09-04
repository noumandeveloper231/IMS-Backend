// routes/productRoutes.js
import express from "express";
import multer from "multer";
import uploadProducts from "../middlewares/uploadProducts.js";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  getProductsByFilter,
  getProductsByFilterStock,
  bulkCreateProducts,
  bulkImportProducts,
  checkSkus,
  deleteProduct,
  uploadProductImage,
  deleteProductImageByUrl,
  getProductDependencies,
  checkBulkDependencies,
  bulkDeletePreview,
  bulkDelete,
  generateAsin,
} from "../controllers/productController.js";
import { getStockCounts } from "../controllers/countController.js";
import { protect, allow } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Multer setup for in-memory Excel upload (no disk on Vercel)
const upload = multer({ storage: multer.memoryStorage() });

// Public endpoints
router.get("/generate-asin", protect, allow("product.create"), generateAsin);
router.post("/create", protect, allow("product.create"), uploadProducts.any(), createProduct);
router.post("/upload-image", protect, allow("product.create"), uploadProducts.single("image"), uploadProductImage);
router.post("/delete-image-by-url", protect, allow("product.create"), deleteProductImageByUrl);
router.get("/getall", protect, allow("product.read"), getProducts);
router.get("/stock-counts", protect, allow("product.read"), getStockCounts);
router.get("/getone/:id", protect, allow("product.read"), getProductById);
router.put("/update/:id", protect, allow("product.update"), uploadProducts.any(), updateProduct);
router.get("/filter/:type/:id", protect, allow("product.read"), getProductsByFilter);
router.get("/filter/stock/:status", protect, allow("product.read"), getProductsByFilterStock);
router.post("/bulk-create", protect, allow("product.create"), bulkCreateProducts);
router.post("/bulk-import", protect, allow("product.create"), upload.single("file"), bulkImportProducts);
router.post("/check-skus", protect, allow("product.read"), checkSkus);
router.delete("/delete/:id", protect, allow("product.delete"), deleteProduct);

// Bulk dependency & delete (like Categories)
router.get("/dependencies/:id", protect, allow("product.read"), getProductDependencies);
router.post("/check-bulk-dependencies", protect, allow("product.delete"), checkBulkDependencies);
router.post("/bulk-delete-preview", protect, allow("product.delete"), bulkDeletePreview);
router.post("/bulk-delete", protect, allow("product.delete"), bulkDelete);

export default router;

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
  deleteProduct,
  uploadProductImage,
  deleteProductImageByUrl,
  getProductDependencies,
  checkBulkDependencies,
  bulkDeletePreview,
  bulkDelete,
} from "../controllers/productController.js";
import { getStockCounts } from "../controllers/countController.js";
const router = express.Router();

// ✅ Multer setup for in-memory Excel upload (no disk on Vercel)
const upload = multer({ storage: multer.memoryStorage() });

// Public endpoints
router.post("/create", uploadProducts.any(), createProduct); // Create (supports multiple images)
router.post("/upload-image", uploadProducts.single("image"), uploadProductImage); // Upload image only (bulk import)
router.post("/delete-image-by-url", deleteProductImageByUrl); // Delete blob image by URL (for import replace)
router.get("/getall", getProducts); // List
router.get("/stock-counts", getStockCounts);
router.get("/getone/:id", getProductById); // Read one
router.put("/update/:id", uploadProducts.any(), updateProduct); // Update (supports multiple images)
router.get("/filter/:type/:id", getProductsByFilter);
router.get("/filter/stock/:status", getProductsByFilterStock);
router.post("/bulk-create", bulkCreateProducts);
router.post("/bulk-import", upload.single("file"), bulkImportProducts);
router.delete("/delete/:id", deleteProduct); // Delete

// Bulk dependency & delete (like Categories)
router.get("/dependencies/:id", getProductDependencies);
router.post("/check-bulk-dependencies", checkBulkDependencies);
router.post("/bulk-delete-preview", bulkDeletePreview);
router.post("/bulk-delete", bulkDelete);
// router.get('/low-stock', verifyToken, allowRoles('admin', 'manager'), async (req, res) => {
//   const items = await checkLowStock();
//   res.json(items);
// });

export default router;

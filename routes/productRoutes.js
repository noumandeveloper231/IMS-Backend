// routes/productRoutes.js
import express from "express";
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
} from "../controllers/productController.js";
import { getStockCounts } from "../controllers/countController.js";
import multer from "multer";

const router = express.Router();

// ✅ Multer setup (file upload temp folder me)
const upload = multer({ dest: "uploads/" });

// Public endpoints
router.post("/create", uploadProducts.single("image"), createProduct); // Create
router.get("/getall", getProducts); // List
router.get("/stock-counts", getStockCounts);
router.get("/getone/:id", getProductById); // Read one
router.put("/update/:id", uploadProducts.single("image"), updateProduct); // Update
router.get("/filter/:type/:id", getProductsByFilter);
router.get("/filter/stock/:status", getProductsByFilterStock);
router.post("/bulk-create", bulkCreateProducts);
router.post("/bulk-import", upload.single("file"), bulkImportProducts);
router.delete("/delete/:id", deleteProduct); // Delete
// router.get('/low-stock', verifyToken, allowRoles('admin', 'manager'), async (req, res) => {
//   const items = await checkLowStock();
//   res.json(items);
// });

export default router;

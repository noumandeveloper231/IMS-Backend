// routes/subcategoryRoutes.js
import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createSubcategory,
  createBulkSubcategories,
  getSubcategories,
  getSubcategoriesByCategory,
  getSubcategoryById,
  updateSubcategory,
  deleteSubcategory,
  getSubcategoryDependencies,
  transferSubcategoryDependencies,
  checkBulkDependencies,
  bulkDeletePreview,
  bulkDelete,
} from "../controllers/subcategoryController.js";

const router = express.Router();

router.post("/create", protect, allow("subcategory.manage"), createSubcategory);
router.post("/createbulk", protect, allow("subcategory.manage"), createBulkSubcategories);
router.get("/getall", protect, allow("subcategory.manage", "product.read"), getSubcategories);
router.get("/getbycategory/:categoryId", protect, allow("subcategory.manage", "product.read"), getSubcategoriesByCategory);
router.get("/getone/:id", protect, allow("subcategory.manage", "product.read"), getSubcategoryById);
router.get("/dependencies/:id", protect, allow("subcategory.manage"), getSubcategoryDependencies);
router.post("/transfer/:id", protect, allow("subcategory.manage"), transferSubcategoryDependencies);
router.put("/update/:id", protect, allow("subcategory.manage"), updateSubcategory);
router.delete("/delete/:id", protect, allow("subcategory.manage"), deleteSubcategory);
router.post("/check-bulk-dependencies", protect, allow("subcategory.manage"), checkBulkDependencies);
router.post("/bulk-delete-preview", protect, allow("subcategory.manage"), bulkDeletePreview);
router.post("/bulk-delete", protect, allow("subcategory.manage"), bulkDelete);

export default router;

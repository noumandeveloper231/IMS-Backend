// routes/subcategoryRoutes.js
import express from "express";
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

router.post("/create", createSubcategory);
router.post("/createbulk", createBulkSubcategories); // Bulk create
router.get("/getall", getSubcategories);
router.get("/getbycategory/:categoryId", getSubcategoriesByCategory);
router.get("/getone/:id", getSubcategoryById);
router.get("/dependencies/:id", getSubcategoryDependencies);
router.post("/transfer/:id", transferSubcategoryDependencies);
router.put("/update/:id", updateSubcategory);
router.delete("/delete/:id", deleteSubcategory);

router.post("/check-bulk-dependencies", checkBulkDependencies);
router.post("/bulk-delete-preview", bulkDeletePreview);
router.post("/bulk-delete", bulkDelete);

export default router;

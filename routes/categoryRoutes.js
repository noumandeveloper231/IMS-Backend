// routes/categoryRoutes.js
import express from "express";
import uploadCategory from "../middlewares/uploadCategory.js";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createCategory,
  createBulkCategories,
  getCategories,
  getCategoriesCount,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryDependencies,
  transferCategoryDependencies,
  uploadCategoryImage,
  deleteCategoryImageByUrl,
  checkBulkDependencies,
  bulkDeletePreview,
  bulkDelete,
} from "../controllers/categoryController.js";

const router = express.Router();

router.post("/create", protect, allow("category.manage"), uploadCategory.single("image"), createCategory);
router.post("/upload-image", protect, allow("category.manage"), uploadCategory.single("image"), uploadCategoryImage);
router.post("/delete-image-by-url", protect, allow("category.manage"), deleteCategoryImageByUrl);
router.post("/createbulk", protect, allow("category.manage"), createBulkCategories);
router.get("/getall", protect, allow("category.manage"), getCategories);
router.get("/getallcount", protect, allow("category.manage"), getCategoriesCount);
router.get("/getone/:id", protect, allow("category.manage"), getCategoryById);
router.get("/dependencies/:id", protect, allow("category.manage"), getCategoryDependencies);
router.post("/transfer/:id", protect, allow("category.manage"), transferCategoryDependencies);
router.get("/transfer/:id", (req, res) =>
  res.status(405).json({ success: false, message: "Use POST to transfer dependencies." })
);
router.post("/check-bulk-dependencies", protect, allow("category.manage"), checkBulkDependencies);
router.post("/bulk-delete-preview", protect, allow("category.manage"), bulkDeletePreview);
router.post("/bulk-delete", protect, allow("category.manage"), bulkDelete);
router.put("/update/:id", protect, allow("category.manage"), uploadCategory.single("image"), updateCategory);
router.delete("/delete/:id", protect, allow("category.manage"), deleteCategory);

export default router;

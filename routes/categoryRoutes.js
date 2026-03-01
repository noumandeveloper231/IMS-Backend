// routes/categoryRoutes.js
import express from "express";
import uploadCategory from "../middlewares/uploadCategory.js";
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

// Public endpoints
router.post("/create", uploadCategory.single("image"), createCategory); // Create
router.post("/upload-image", uploadCategory.single("image"), uploadCategoryImage); // Upload image only
router.post("/delete-image-by-url", deleteCategoryImageByUrl); // Delete blob image by URL (for import replace)
router.post("/createbulk", createBulkCategories); // Bulk Create
router.get("/getall", getCategories); // List
router.get("/getallcount", getCategoriesCount); // List
router.get("/getone/:id", getCategoryById); // Read one
router.get("/dependencies/:id", getCategoryDependencies); // Get dependencies
router.post("/transfer/:id", transferCategoryDependencies); // Transfer then delete
// Prevent GET /transfer/:id from returning "Cannot GET" (return 405 if someone hits it with GET)
router.get("/transfer/:id", (req, res) =>
  res.status(405).json({ success: false, message: "Use POST to transfer dependencies." })
);

// Bulk dependency & delete (enterprise)
router.post("/check-bulk-dependencies", checkBulkDependencies);
router.post("/bulk-delete-preview", bulkDeletePreview);
router.post("/bulk-delete", bulkDelete);

router.put("/update/:id", uploadCategory.single("image"), updateCategory); // Update
router.delete("/delete/:id", deleteCategory); // Delete

export default router;

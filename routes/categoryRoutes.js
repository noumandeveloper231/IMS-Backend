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
} from "../controllers/categoryController.js";

const router = express.Router();

// Public endpoints
router.post("/create", uploadCategory.single("image"), createCategory); // Create
router.post("/createbulk", createBulkCategories); // Bulk Create
router.get("/getall", getCategories); // List
router.get("/getallcount", getCategoriesCount); // List
router.get("/getone/:id", getCategoryById); // Read one
router.put("/update/:id", uploadCategory.single("image"), updateCategory); // Update
router.delete("/delete/:id", deleteCategory); // Delete

export default router;

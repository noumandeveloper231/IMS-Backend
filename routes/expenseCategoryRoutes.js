// routes/expenseCategoryRoutes.js
import express from "express";
import {
  createExpenseCategory,
  getExpenseCategories,
  getExpenseCategoryById,
  updateExpenseCategory,
  deleteExpenseCategory,
} from "../controllers/expenseCategoryController.js";

const router = express.Router();

// Public endpoints
router.post("/create", createExpenseCategory); // Create
router.get("/getall", getExpenseCategories); // List
router.get("/getone/:id", getExpenseCategoryById); // Read one
router.put("/update/:id", updateExpenseCategory); // Update
router.delete("/delete/:id", deleteExpenseCategory); // Delete

export default router;

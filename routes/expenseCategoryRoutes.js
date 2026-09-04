// routes/expenseCategoryRoutes.js
import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createExpenseCategory,
  getExpenseCategories,
  getExpenseCategoryById,
  updateExpenseCategory,
  deleteExpenseCategory,
} from "../controllers/expenseCategoryController.js";

const router = express.Router();

router.post("/create", protect, allow("expense.manage"), createExpenseCategory);
router.get("/getall", protect, allow("expense.manage"), getExpenseCategories);
router.get("/getone/:id", protect, allow("expense.manage"), getExpenseCategoryById);
router.put("/update/:id", protect, allow("expense.manage"), updateExpenseCategory);
router.delete("/delete/:id", protect, allow("expense.manage"), deleteExpenseCategory);

export default router;

// routes/expenseRoutes.js
import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from "../controllers/expenseController.js";

const router = express.Router();

router.post("/create", protect, allow("expense.manage"), createExpense);
router.get("/getall", protect, allow("expense.manage"), getExpenses);
router.get("/getone/:id", protect, allow("expense.manage"), getExpenseById);
router.put("/update/:id", protect, allow("expense.manage"), updateExpense);
router.delete("/delete/:id", protect, allow("expense.manage"), deleteExpense);

export default router;

import express from "express";
import {
  createEmployee,
  createBulkEmployees,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employeeController.js";

const router = express.Router();

// ✅ Routes
router.post("/", createEmployee); // Create Employee
router.post("/createbulk", createBulkEmployees); // Bulk create (must be before /:id)
router.get("/", getEmployees); // Get All Employees
router.get("/:id", getEmployeeById); // Get Single Employee
router.put("/:id", updateEmployee); // Update Employee
router.delete("/:id", deleteEmployee); // Delete Employee

export default router;

import express from "express";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createEmployee,
  createBulkEmployees,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employeeController.js";

const router = express.Router();

router.post("/", protect, allow("employee.manage"), createEmployee);
router.post("/createbulk", protect, allow("employee.manage"), createBulkEmployees);
router.get("/", protect, allow("employee.manage"), getEmployees);
router.get("/:id", protect, allow("employee.manage"), getEmployeeById);
router.put("/:id", protect, allow("employee.manage"), updateEmployee);
router.delete("/:id", protect, allow("employee.manage"), deleteEmployee);

export default router;

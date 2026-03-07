import express from "express";
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customerController.js";
import { body } from "express-validator";
import { validate } from "../middlewares/validate.js";
import { protect, allow } from "../middlewares/authMiddleware.js";

const router = express.Router();

const createValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("phone").optional().trim(),
  body("email").optional().isEmail(),
];

router.get("/", protect, allow("customer.manage"), getCustomers);
router.get("/:id", protect, allow("customer.manage"), getCustomerById);
router.post("/", protect, allow("customer.manage"), createValidation, validate, createCustomer);
router.put("/:id", protect, allow("customer.manage"), createValidation, validate, updateCustomer);
router.delete("/:id", protect, allow("customer.manage"), deleteCustomer);

export default router;

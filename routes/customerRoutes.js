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

const router = express.Router();

const createValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("phone").optional().trim(),
  body("email").optional().isEmail(),
];

router.get("/", getCustomers);
router.get("/:id", getCustomerById);
router.post("/", createValidation, validate, createCustomer);
router.put("/:id", createValidation, validate, updateCustomer);
router.delete("/:id", deleteCustomer);

export default router;

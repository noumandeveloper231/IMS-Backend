import { body } from "express-validator";

export const createSaleValidation = [
  body("customer")
    .isObject()
    .withMessage("Customer is required"),
  body("customer.name")
    .trim()
    .notEmpty()
    .withMessage("Customer name is required"),
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item is required"),
  body("items.*.product")
    .notEmpty()
    .withMessage("Product is required for each item"),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  body("items.*.price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  body("employee").notEmpty().withMessage("Employee (seller) is required"),
  body("discount").optional().isFloat({ min: 0 }),
  body("shipping").optional().isFloat({ min: 0 }),
  body("paymentMethod")
    .optional()
    .isIn(["cash", "card", "bankTransfer", "other"]),
  body("sellat")
    .optional()
    .isIn(["shop", "website", "warehouse", "amazon", "noon", "cartlow"]),
];

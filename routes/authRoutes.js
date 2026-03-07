import express from "express";
import { body } from "express-validator";
import { register, login, getMe } from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";

const router = express.Router();

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role")
      .optional()
      .custom((val) => {
        if (val == null) return true;
        if (typeof val === "string" && ["admin", "manager", "salesman", "inventory_manager", "viewer"].includes(val))
          return true;
        if (typeof val === "string" && /^[a-fA-F0-9]{24}$/.test(val)) return true;
        return false;
      })
      .withMessage("Role must be a role name or valid Role ID"),
  ],
  validate,
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  login
);

router.get("/me", protect, getMe);

export default router;

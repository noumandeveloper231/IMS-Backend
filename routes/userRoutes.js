import express from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  updateProfile,
  updatePassword,
  uploadProfilePicture,
} from "../controllers/userController.js";
import { body } from "express-validator";
import { validate } from "../middlewares/validate.js";
import { protect, allow } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

const createValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("role").isMongoId().withMessage("Valid role is required"),
  body("employee").optional().isMongoId().withMessage("Valid employee id"),
  body("status").optional().isIn(["active", "inactive"]),
];

const updateValidation = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("password")
    .optional()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("role").optional().isMongoId().withMessage("Valid role id"),
  body("employee")
    .optional({ values: "null" })
    .isMongoId()
    .withMessage("Valid employee id"),
  body("status").optional().isIn(["active", "inactive"]),
];

const statusValidation = [
  body("status")
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
];

const profileValidation = [
  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("First name cannot be empty"),
  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Last name cannot be empty"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("profilePicture").optional(),
];

const passwordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

router.get("/", protect, allow("user.manage", "user.read"), getUsers);
router.get("/:id", protect, allow("user.manage", "user.read"), getUserById);
router.post(
  "/",
  protect,
  allow("user.manage", "user.create"),
  createValidation,
  validate,
  createUser,
);

// Profile and password routes (for current user) - must come before /:id
router.put("/profile", protect, profileValidation, validate, updateProfile);
router.post(
  "/profile-picture",
  protect,
  upload.single("image"),
  uploadProfilePicture,
);
router.put("/password", protect, passwordValidation, validate, updatePassword);

router.put(
  "/:id",
  protect,
  allow("user.manage", "user.update"),
  updateValidation,
  validate,
  updateUser,
);
router.patch(
  "/:id/status",
  protect,
  allow("user.manage", "user.update"),
  statusValidation,
  validate,
  updateUserStatus,
);

export default router;

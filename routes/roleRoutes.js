import express from "express";
import { getRoles, getRoleById } from "../controllers/roleController.js";
import { protect, allow } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", protect, allow("user.manage", "user.read"), getRoles);
router.get("/:id", protect, allow("user.manage", "user.read"), getRoleById);

export default router;

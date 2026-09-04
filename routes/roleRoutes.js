import express from "express";
import {
  getPermissions,
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/roleController.js";
import { protect, allow } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/permissions", protect, allow("user.manage"), getPermissions);
router.get("/", protect, allow("user.manage", "user.read"), getRoles);
router.get("/:id", protect, allow("user.manage", "user.read"), getRoleById);
router.post("/", protect, allow("user.manage"), createRole);
router.put("/:id", protect, allow("user.manage"), updateRole);
router.delete("/:id", protect, allow("user.manage"), deleteRole);

export default router;

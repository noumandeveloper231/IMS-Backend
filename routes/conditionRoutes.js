// routes/conditionRoutes.js
import express from "express";
import upload from "../middlewares/uploadConditions.js";
import { protect, allow } from "../middlewares/authMiddleware.js";
import {
  createCondition,
  createBulkConditions,
  getConditions,
  getConditionsCount,
  getConditionById,
  updateCondition,
  deleteCondition,
  getConditionDependencies,
  transferConditionDependencies,
  uploadConditionImage,
  deleteConditionImageByUrl,
  checkBulkDependencies,
  bulkDeletePreview,
  bulkDelete,
} from "../controllers/conditionController.js";

const router = express.Router();

router.post("/create", protect, allow("condition.manage"), upload.single("image"), createCondition);
router.post("/upload-image", protect, allow("condition.manage"), upload.single("image"), uploadConditionImage);
router.post("/delete-image-by-url", protect, allow("condition.manage"), deleteConditionImageByUrl);
router.post("/createbulk", protect, allow("condition.manage"), createBulkConditions);
router.get("/getall", protect, allow("condition.manage", "product.read"), getConditions);
router.get("/getallcount", protect, allow("condition.manage", "product.read"), getConditionsCount);
router.get("/getone/:id", protect, allow("condition.manage", "product.read"), getConditionById);
router.get("/dependencies/:id", protect, allow("condition.manage"), getConditionDependencies);
router.post("/transfer/:id", protect, allow("condition.manage"), transferConditionDependencies);
router.get("/transfer/:id", (req, res) =>
  res.status(405).json({ success: false, message: "Use POST to transfer dependencies." })
);
router.post("/check-bulk-dependencies", protect, allow("condition.manage"), checkBulkDependencies);
router.post("/bulk-delete-preview", protect, allow("condition.manage"), bulkDeletePreview);
router.post("/bulk-delete", protect, allow("condition.manage"), bulkDelete);
router.put("/update/:id", protect, allow("condition.manage"), upload.any(), updateCondition);
router.delete("/delete/:id", protect, allow("condition.manage"), deleteCondition);

export default router;

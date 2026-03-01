// routes/conditionRoutes.js
import express from "express";
import upload from "../middlewares/uploadConditions.js";
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
} from "../controllers/conditionController.js";

const router = express.Router();

// Public endpoints
router.post("/create", upload.single("image"), createCondition); // Create
router.post("/upload-image", upload.single("image"), uploadConditionImage); // Upload image only
router.post("/delete-image-by-url", deleteConditionImageByUrl); // Delete blob image by URL (for import replace)
router.post("/createbulk", createBulkConditions); // Bulk Create
router.get("/getall", getConditions); // List
router.get("/getallcount", getConditionsCount); // List
router.get("/getone/:id", getConditionById); // Read one
router.get("/dependencies/:id", getConditionDependencies); // Get dependencies
router.post("/transfer/:id", transferConditionDependencies); // Transfer then delete
router.get("/transfer/:id", (req, res) =>
  res.status(405).json({ success: false, message: "Use POST to transfer dependencies." })
);
router.put("/update/:id", upload.single("image"), updateCondition); // Update
router.delete("/delete/:id", deleteCondition); // Delete

export default router;

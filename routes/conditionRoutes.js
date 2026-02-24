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
} from "../controllers/conditionController.js";

const router = express.Router();

// Public endpoints
router.post("/create", upload.single("image"), createCondition); // Create
router.post("/createbulk", createBulkConditions); // Bulk Create
router.get("/getall", getConditions); // List
router.get("/getallcount", getConditionsCount); // List
router.get("/getone/:id", getConditionById); // Read one
router.put("/update/:id", upload.single("image"), updateCondition); // Update
router.delete("/delete/:id", deleteCondition); // Delete

export default router;

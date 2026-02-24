// routes/subcategoryRoutes.js
import express from "express";
import {
  createSubcategory,
  getSubcategories,
  getSubcategoriesByCategory,
  getSubcategoryById,
  updateSubcategory,
  deleteSubcategory,
} from "../controllers/subcategoryController.js";

const router = express.Router();

router.post("/create", createSubcategory);
router.get("/getall", getSubcategories);
router.get("/getbycategory/:categoryId", getSubcategoriesByCategory);
router.get("/getone/:id", getSubcategoryById);
router.put("/update/:id", updateSubcategory);
router.delete("/delete/:id", deleteSubcategory);

export default router;

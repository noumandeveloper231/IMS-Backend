import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { globalSearch } from "../controllers/searchController.js";

const router = express.Router();

router.get("/", protect, globalSearch);

export default router;

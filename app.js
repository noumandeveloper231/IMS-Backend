import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import errorHandler from "./middlewares/errorHandler.js";
import CategoryRoutes from "./routes/categoryRoutes.js";
import SubcategoryRoutes from "./routes/subcategoryRoutes.js";
import BrandRoutes from "./routes/brandRoutes.js";
import ConditionRoutes from "./routes/conditionRoutes.js";
import ProductRoutes from "./routes/productRoutes.js";
import SaleRoutes from "./routes/saleRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import expenseCategoryRoutes from "./routes/expenseCategoryRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import purchaseReceiveRoutes from "./routes/purchaseReceiveRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import countRoutes from "./routes/countRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

dotenv.config();

const app = express();
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174").split(",");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serverless: ensure DB is connected on first request (no process.exit)
let dbPromise = null;
const ensureDb = async (req, res, next) => {
  if (dbPromise) {
    await dbPromise;
    return next();
  }
  dbPromise = connectDB(process.env.MONGO_URI);
  try {
    await dbPromise;
    next();
  } catch (err) {
    next(err);
  }
};

app.use(express.json());
app.use(cors({ origin: CORS_ORIGINS }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// In production (Vercel serverless), connect DB on first request
if (process.env.NODE_ENV === "production") {
  app.use(ensureDb);
}

app.use("/api/auth", authRoutes);
app.use("/api/categories", CategoryRoutes);
app.use("/api/subcategories", SubcategoryRoutes);
app.use("/api/brands", BrandRoutes);
app.use("/api/conditions", ConditionRoutes);
app.use("/api/products", ProductRoutes);
app.use("/api/sales", SaleRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/expense-categories", expenseCategoryRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/purchase-receives", purchaseReceiveRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api", countRoutes);

app.use(errorHandler);

export default app;

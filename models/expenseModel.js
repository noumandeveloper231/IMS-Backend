// models/Expense.js
import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true, // Expense ka naam (Electricity Bill, Rent etc.)
    },
    // category: {
    //   type: String,
    //   enum: ["electricity", "rent", "delivery", "maintenance", "other"],
    //   default: "other",
    // },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseCategory", // 👈 ab ye refer karega ExpenseCategory model ko
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    image: {
      type: String, // yaha image ka URL ya filename store hoga
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor", // agar kisi vendor ko payment hui hai
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "credit"],
      default: "cash",
    },
    expenseDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "paid",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);

import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String, unique: true, sparse: true },
    role: {
      type: String,
      enum: ["salesman", "cashier", "manager", "admin"],
      default: "salesman",
    },
    salary: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Employee", employeeSchema);

import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    city: { type: String },
    country: { type: String },
    notes: { type: String },
    loyaltyPoints: { type: Number, default: 0 },
    totalPurchases: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

customerSchema.index({ name: "text", phone: "text", email: "text" });

export default mongoose.model("Customer", customerSchema);

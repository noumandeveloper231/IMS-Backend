import mongoose from "mongoose";

const Refund = new mongoose.Schema({
  sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  qty: { type: Number, required: false },
  amount: { type: Number, required: false },
  reason: { type: String, required: false },
  date: { type: Date, default: Date.now },
  //   processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});
export default mongoose.model("Refund", Refund);

// 👆 Refund Model for tracking refunds

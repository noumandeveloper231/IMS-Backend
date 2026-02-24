// models/Batch.js
import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    purchaseReceive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseReceive",
      required: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    qtyReceived: { type: Number, required: true },
    qtyRemaining: { type: Number, required: true }, // FIFO me isko ghataoge
    unitPrice: { type: Number, required: true },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["available", "consumed"],
      default: "available",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Batch", batchSchema);

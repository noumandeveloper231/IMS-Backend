// models/PurchaseReceive.js
import mongoose from "mongoose";

const purchaseReceiveSchema = new mongoose.Schema(
  {
    receiveNo: {
      type: String,
      required: true,
      unique: true, // har receive ka alag number
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true, // kis order se linked hai
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        title: { type: String, required: false },
        asin: { type: String, required: false },
        orderedQty: { type: Number, required: true },
        receivedQty: { type: Number, required: true },
        purchasePrice: { type: Number, required: true },
        total: { type: Number, required: true },
        status: {
          type: String,
          enum: ["approved", "partial", "missing", "extra", "priceChanged", "wrongItem"],
          default: "approved",
        }
      },
    ],
    receiveDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["partially", "completed"],
      default: "partially",
    },
    notes: {
      type: String,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PurchaseReceive", purchaseReceiveSchema);

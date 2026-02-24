// models/PurchaseOrder.js
import mongoose from "mongoose";

const purchaseOrderSchema = new mongoose.Schema(
  {
    orderNo: {
      type: String,
      required: true,
      unique: true, // har order ka unique number hoga
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true, // kis vendor se order kiya
    },
    items: [
      {
        // product: {
        //   type: mongoose.Schema.Types.ObjectId,
        //   ref: "Product",
        //   required: false,
        // },
        title: { type: String, required: false },
        asin: { type: String, required: false },
        orderedQty: { type: Number, required: true },
        receivedQty: { type: Number, default: 0}, // ✅ Kitni qty receive hui
        purchasePrice: { type: Number, required: true },
        total: { type: Number, required: true },
        status: {
          type: String,
          enum: ["pending", "approved"],

          default: "pending",
        },
      },
    ],
    orderDate: {
      type: Date,
      default: Date.now,
    },
    expectedDelivery: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "approved","processing", "partially", "completed"], // ⚡ yahan fix kiya
      default: "processing",
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

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);

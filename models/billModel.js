import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor", // jis vendor ka bill h
      required: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder", // jis PO se bill generate hua
    },
    billDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date, // kis date tak payment karni h
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product", // Product reference
        },
        description: String,
        quantity: Number,
        unitPrice: Number,
        total: Number,
      },
    ],
    subTotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);

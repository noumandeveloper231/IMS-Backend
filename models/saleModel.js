import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true, // har sale ka unique invoice hoga
    },
    customer: {
      name: { type: String, required: true },
      phone: { type: String },
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        batch: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Batch", // ✅ FIFO ke liye batch reference
        },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }, // selling price per unit
        purchasePrice: { type: Number }, // ✅ batch se uthake save hoga (COGS)
        total: { type: Number, required: true }, // price * quantity
        returnable: { type: Boolean, default: true },
        refunded: { type: Boolean, default: false }, // 👈 refund tracking
        refundAmount: { type: Number, default: 0 },
        returnable: { type: Boolean, default: true }, // 👈 yahan override kar sakte ho
      },
    ],
    subTotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    COGS: { type: Number, default: 0 }, // ✅ Cost of Goods Sold (FIFO se calculate hoga)
    profit: { type: Number, default: 0 }, // ✅ profit = grandTotal - COGS
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "bankTransfer", "other"],
      default: "cash",
    },
    sellat: {
      type: String,
      enum: ["shop", "website", "warehouse", "amazon", "noon", "cartlow"],
      default: "shop",
    },
    // ✅ Employee reference
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    salesnote: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
    },
    // createdBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User",
    // },
  },
  { timestamps: true }
);

export default mongoose.model("Sale", saleSchema);

import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    sku: { type: String, required: true },
    asin: { type: String, required: true },
    purchasePrice: { type: Number, required: true },
    salePrice: { type: Number, required: false },
    quantity: { type: Number, required: true, default: 0 },
    totalCost: { type: Number, default: 0 }, // For weighted avg when no batches
    description: { type: String, required: false },
    specification: { type: String, required: false },
    modelno: { type: String, required: false },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: false,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      required: false,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: false,
    },
    condition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Condition",
      required: false,
    },
    thumbnail: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      default: null,
    },
    gallery: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
      },
    ],
    images: [
      {
        type: String,
      },
    ],
    image: {
      type: String,
    },
    qrCode: { type: String },
    competitors: {
      type: Object,
      required: false,
    },
    ourMarketplace: {
      type: Object,
      required: false,
    },
    returnable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);

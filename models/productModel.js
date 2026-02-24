import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, require: true },
    sku: { type: String, require: true },
    asin: { type: String, require: true },
    purchasePrice: { type: Number, required: true },
    salePrice: { type: Number, required: false },
    quantity: { type: Number, required: true, default: 0 },
    totalCost: { type: Number, default: 0 }, // For weighted avg when no batches
    description: { type: String, required: false },
    modelno: { type: String, required: false },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: false,
      },
    ],
    subcategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subcategory",
        required: false,
      },
    ],
    brands: [
      {
        type: mongoose.Schema.Types.ObjectId, // Referencing the Brand model
        ref: "Brand", // Reference to the Brand model
        required: true,
      },
    ],
    conditions: [
      {
        type: mongoose.Schema.Types.ObjectId, // Referencing the Condition model
        ref: "Condition", // Reference to the Condition model
        required: true,
      },
    ],
    // ✅ If you want multiple images
    // images: [{ type: String }],
    image: {
      type: String, // yaha image ka URL ya filename store hoga
    },
    // ✅ QR code image (base64 ya image URL store karne ke liye)
    qrCode: { type: String },
    // ✅ new field
    returnable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);

// models/Brand.js
import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      unique: true,
    },
    logo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      default: null,
    },
    image: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const Brand = mongoose.model("Brand", brandSchema);
export default Brand;

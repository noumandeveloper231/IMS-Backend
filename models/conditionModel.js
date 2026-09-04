// models/Condition.js
import mongoose from "mongoose";

const conditionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Condition name is required"],
      trim: true,
      unique: true,
    },
    image: {
      type: String,
      default: null,
    },
    imageRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    exampleProductImages: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const Condition = mongoose.model("Condition", conditionSchema);
export default Condition;

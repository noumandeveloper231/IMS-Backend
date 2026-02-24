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
      type: String, // yaha image ka URL ya filename store hoga
    },
  },
  { timestamps: true }
);

const Condition = mongoose.model("Condition", conditionSchema);
export default Condition;

import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    alt: { type: String, default: "" },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    format: { type: String, default: null },
    size: { type: Number, default: null },
    folder: { type: String, default: "gallery" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

mediaSchema.index({ createdAt: -1 });
mediaSchema.index({ folder: 1 });
mediaSchema.index({ isDeleted: 1 });

export default mongoose.model("Media", mediaSchema);

import mongoose from "mongoose";

const folderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Path used in Cloudinary (e.g. "gallery" or "gallery/events"). Folder is created on Cloudinary when first image is uploaded to this path. */
    path: { type: String, required: true, unique: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("GalleryFolder", folderSchema);

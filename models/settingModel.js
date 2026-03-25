import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    siteName: { type: String, default: "" },
    siteIcon: { type: String, default: "" },
    siteLogo: { type: String, default: "" },
    siteFavicon: { type: String, default: "" },
    siteTagline: { type: String, default: "" },
    siteDescription: { type: String, default: "" },
    placeholderImage: { type: String, default: "" },
    skuPrefix: { type: String, default: "AR" },
    currency: { type: String, default: "AED" },
    // Extend with more keys as needed
  },
  { timestamps: true }
);

const Setting = mongoose.model("Setting", settingSchema);
export default Setting;

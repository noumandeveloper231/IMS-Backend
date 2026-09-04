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
    accentColor: { type: String, default: "#111827" },
    accentColorRecents: { type: [String], default: [] },
    accentColorPresets: {
      type: [String],
      default: [
        "#FABC00", "#FF9800", "#FF6D00", "#CF550E", "#E74600", "#EA6D52", "#D0323A", "#FF434A",
        "#E84859", "#F80A27", "#EA006D", "#CA005D", "#DD0395", "#C30089", "#BB41B6", "#A90EA0",
        "#197CCB", "#156CB0", "#8684CD", "#6A6BCB", "#876ABD", "#7752AF", "#A84CC1", "#8F24A8",
        "#1A98B7", "#3A85A3", "#1DAFBA", "#158A8F", "#15AE98", "#0D8B7D", "#0ECC66", "#1A923F",
        "#898383", "#656261", "#6D7D94", "#586679", "#648B82", "#4E746D", "#498C00", "#0E8B11",
        "#818181", "#545251", "#74848D", "#4F5A61", "#6F866B", "#5A685E", "#8A7D4C", "#877E68",
      ],
    },
    accentColorCustoms: { type: [String], default: [] },
    // Extend with more keys as needed
  },
  { timestamps: true }
);

const Setting = mongoose.model("Setting", settingSchema);
export default Setting;

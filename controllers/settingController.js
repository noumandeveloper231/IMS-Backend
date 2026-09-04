import Setting from "../models/settingModel.js";
import { uploadToBlob } from "../utils/blob.js";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const normalizeHexColor = (value) => {
  const raw = String(value || "").trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  const isThreeDigitHex = /^[0-9a-fA-F]{3}$/.test(hex);
  const isSixDigitHex = /^[0-9a-fA-F]{6}$/.test(hex);
  if (!isThreeDigitHex && !isSixDigitHex) return null;
  const sixDigit = isThreeDigitHex
    ? hex
        .split("")
        .map((char) => char + char)
        .join("")
    : hex;
  return `#${sixDigit.toUpperCase()}`;
};

const DEFAULT_PRESET_COLORS = [
  "#FABC00", "#FF9800", "#FF6D00", "#CF550E", "#E74600", "#EA6D52", "#D0323A", "#FF434A",
  "#E84859", "#F80A27", "#EA006D", "#CA005D", "#DD0395", "#C30089", "#BB41B6", "#A90EA0",
  "#197CCB", "#156CB0", "#8684CD", "#6A6BCB", "#876ABD", "#7752AF", "#A84CC1", "#8F24A8",
  "#1A98B7", "#3A85A3", "#1DAFBA", "#158A8F", "#15AE98", "#0D8B7D", "#0ECC66", "#1A923F",
  "#898383", "#656261", "#6D7D94", "#586679", "#648B82", "#4E746D", "#498C00", "#0E8B11",
  "#818181", "#545251", "#74848D", "#4F5A61", "#6F866B", "#5A685E", "#8A7D4C", "#877E68",
];

const normalizeColorArray = (list, max = 20) => {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const normalized = [];
  for (const item of list) {
    const color = normalizeHexColor(item);
    if (!color || seen.has(color)) continue;
    seen.add(color);
    normalized.push(color);
    if (normalized.length >= max) break;
  }
  return normalized;
};

// Get settings (single document; create if none)
export const getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
    if (settings.skuPrefix == null) {
      settings.skuPrefix = "AR";
      await settings.save();
    }
    if (settings.currency == null) settings.currency = "AED";
    if (settings.accentColor == null) settings.accentColor = "#111827";
    if (!Array.isArray(settings.accentColorRecents)) settings.accentColorRecents = [];
    const normalizedSavedPresets = normalizeColorArray(settings.accentColorPresets || [], 64) || [];
    settings.accentColorPresets = normalizeColorArray(
      [...DEFAULT_PRESET_COLORS, ...normalizedSavedPresets],
      64,
    );
    if (!Array.isArray(settings.accentColorCustoms)) settings.accentColorCustoms = [];
    if (settings.siteLogo == null) settings.siteLogo = "";
    if (settings.placeholderImage == null) settings.placeholderImage = "";
    if (settings.siteIcon == null) settings.siteIcon = "";
    res.status(200).json({ success: true, settings });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
};

// Update settings (single document)
export const updateSettings = async (req, res) => {
  try {
    const {
      siteName,
      siteIcon,
      siteLogo,
      placeholderImage,
      siteFavicon,
      siteTagline,
      siteDescription,
      skuPrefix,
      currency,
      accentColor,
      accentColorRecents,
      accentColorPresets,
      accentColorCustoms,
    } = req.body;
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
    if (siteName !== undefined) settings.siteName = siteName;
    if (siteIcon !== undefined) settings.siteIcon = siteIcon;
    if (siteFavicon !== undefined) settings.siteFavicon = siteFavicon;
    if (siteTagline !== undefined) settings.siteTagline = siteTagline;
    if (siteDescription !== undefined) settings.siteDescription = siteDescription;
    if (siteLogo !== undefined) settings.siteLogo = siteLogo;
    if (placeholderImage !== undefined) settings.placeholderImage = placeholderImage;
    if (skuPrefix !== undefined) settings.skuPrefix = String(skuPrefix).toUpperCase();
    if (currency !== undefined) settings.currency = String(currency).toUpperCase();
    if (accentColor !== undefined) {
      const normalizedAccent = normalizeHexColor(accentColor);
      if (normalizedAccent === null && String(accentColor).trim() !== "") {
        return res.status(400).json({
          success: false,
          message: "Invalid accent color. Use a hex value like #111827.",
        });
      }
      settings.accentColor = normalizedAccent || "#111827";
    }
    if (accentColorRecents !== undefined) {
      const normalized = normalizeColorArray(accentColorRecents, 12);
      if (normalized === null) {
        return res.status(400).json({
          success: false,
          message: "accentColorRecents must be an array of hex colors.",
        });
      }
      settings.accentColorRecents = normalized;
    }
    if (accentColorPresets !== undefined) {
      const normalized = normalizeColorArray(accentColorPresets, 64);
      if (normalized === null || normalized.length === 0) {
        return res.status(400).json({
          success: false,
          message: "accentColorPresets must be a non-empty array of hex colors.",
        });
      }
      settings.accentColorPresets = normalized;
    }
    if (accentColorCustoms !== undefined) {
      const normalized = normalizeColorArray(accentColorCustoms, 64);
      if (normalized === null) {
        return res.status(400).json({
          success: false,
          message: "accentColorCustoms must be an array of hex colors.",
        });
      }
      settings.accentColorCustoms = normalized;
    }
    await settings.save();
    res.status(200).json({ success: true, message: "Settings updated", settings });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error.message,
    });
  }
};

const uploadAndPersist = async (req, res, fieldName) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const url = await uploadToBlob(req.file, "settings");
    if (!url) {
      return res.status(500).json({ success: false, message: "Failed to upload image" });
    }

    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});

    settings[fieldName] = url;
    await settings.save();

    res.status(200).json({ success: true, url, settings });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upload setting image",
      error: error.message,
    });
  }
};

export const uploadSiteLogo = async (req, res) => uploadAndPersist(req, res, "siteLogo");
export const uploadPlaceholderImage = async (req, res) =>
  uploadAndPersist(req, res, "placeholderImage");

export const uploadSiteIcon = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const originalName = (req.file.originalname || "").toLowerCase();
    const mime = (req.file.mimetype || "").toLowerCase();

    let icoBuffer = null;
    const isIcoUpload =
      originalName.endsWith(".ico") ||
      mime === "image/x-icon" ||
      mime === "image/vnd.microsoft.icon";

    if (isIcoUpload) {
      icoBuffer = req.file.buffer;
    } else {
      const png32 = await sharp(req.file.buffer)
        .resize(32, 32, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      icoBuffer = await pngToIco(png32);
    }

    const faviconFile = {
      ...req.file,
      buffer: icoBuffer,
      originalname: "favicon.ico",
      mimetype: "image/x-icon",
    };

    const url = await uploadToBlob(faviconFile, "settings");
    if (!url) {
      return res.status(500).json({ success: false, message: "Failed to upload favicon" });
    }

    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    settings.siteIcon = url;
    await settings.save();

    res.status(200).json({ success: true, url, settings });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upload favicon",
      error: error.message,
    });
  }
};

import Setting from "../models/settingModel.js";
import { uploadToBlob } from "../utils/blob.js";
import sharp from "sharp";
import pngToIco from "png-to-ico";

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

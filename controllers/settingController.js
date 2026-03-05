import Setting from "../models/settingModel.js";

// Get settings (single document; create if none)
export const getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
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
    const { siteName, siteIcon, siteFavicon, siteTagline, siteDescription } = req.body;
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
    if (siteName !== undefined) settings.siteName = siteName;
    if (siteIcon !== undefined) settings.siteIcon = siteIcon;
    if (siteFavicon !== undefined) settings.siteFavicon = siteFavicon;
    if (siteTagline !== undefined) settings.siteTagline = siteTagline;
    if (siteDescription !== undefined) settings.siteDescription = siteDescription;
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

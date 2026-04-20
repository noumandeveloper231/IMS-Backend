import Media from "../models/mediaModel.js";
import { getPublicIdFromCloudinaryUrl } from "./blob.js";

/**
 * Ensures an image URL is added to the Media (Gallery) collection.
 * Skips if it's not a Cloudinary URL or if it already exists in the gallery.
 * @param {string} url - The image URL to sync.
 * @param {string} alt - Alt text for the gallery entry.
 * @param {string} folder - Gallery folder name.
 * @param {string} userId - ID of the user who performed the action.
 * @returns {Promise<string|null>} - The Media record ID if created or found, else null.
 */
export const syncImageToGallery = async (url, alt = "", folder = "gallery", userId = null) => {
  if (!url || typeof url !== "string") return null;
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  const publicId = getPublicIdFromCloudinaryUrl(trimmedUrl);
  if (!publicId) return null; // Only sync Cloudinary URLs to gallery

  // Check if it already exists in the gallery
  let media = await Media.findOne({ url: trimmedUrl, isDeleted: { $ne: true } });
  
  if (!media) {
    // If it doesn't exist, create it
    media = await Media.create({
      url: trimmedUrl,
      public_id: publicId,
      alt: alt || "Uploaded Image",
      folder: folder || "gallery",
      createdBy: userId,
    });
  }
  
  return media._id;
};

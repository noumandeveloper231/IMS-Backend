import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

let cloudinaryConfigured = false;

const MAX_IMAGE_DIMENSION = 2560;
const WEBP_QUALITY = 82;

async function optimizeImageBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return null;
  try {
    return await sharp(buffer)
      .rotate() // auto-orient from EXIF
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}

function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured) return;

  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
  } = process.env;

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  cloudinaryConfigured = true;
}

function getResourceType(file) {
  const mime = (file.mimetype || "").toLowerCase();
  const name = (file.originalname || "").toLowerCase();
  if (
    name.endsWith(".ico") ||
    mime === "image/x-icon" ||
    mime === "image/vnd.microsoft.icon"
  ) {
    // Keep favicon as raw .ico (do not optimize to webp)
    return "raw";
  }
  if (/^video\//.test(mime) || /\.(mp4|webm|mov|avi|mkv)$/.test(name)) return "video";
  if (/^application\/pdf$/i.test(mime) || name.endsWith(".pdf")) return "raw";
  if (/^(application|text)\//.test(mime) || /\.(doc|docx|xls|xlsx|txt|zip)$/.test(name)) return "raw";
  return "image"; // default for images and unknown
}

export const uploadToBlob = async (file, folder) => {
  if (!file || !file.buffer) return null;

  ensureCloudinaryConfigured();

  const resourceType = getResourceType(file);
  const baseFolder = process.env.CLOUDINARY_FOLDER || "";
  const folderPath = baseFolder ? `${baseFolder}/${folder}` : folder;

  let bufferToUpload = file.buffer;
  if (resourceType === "image") {
    const optimized = await optimizeImageBuffer(file.buffer);
    if (optimized) bufferToUpload = optimized;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        resource_type: resourceType,
      },
      (err, result) => {
        if (err) {
          console.warn("Cloudinary upload failed:", err?.message || err);
          return reject(err);
        }
        resolve(result?.secure_url ?? null);
      }
    );
    uploadStream.end(bufferToUpload);
  });
};

const MEDIA_FOLDER = "gallery";

export const uploadToBlobWithMetadata = async (file, folder = MEDIA_FOLDER) => {
  if (!file || !file.buffer) return null;

  ensureCloudinaryConfigured();

  const resourceType = getResourceType(file);
  if (resourceType !== "image") return null; // Media library: images only for now

  const baseFolder = process.env.CLOUDINARY_FOLDER || "";
  const folderPath = baseFolder ? `${baseFolder}/${folder}` : folder;

  let bufferToUpload = file.buffer;
  const optimized = await optimizeImageBuffer(file.buffer);
  if (optimized) bufferToUpload = optimized;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderPath, resource_type: "image" },
      (err, result) => {
        if (err) {
          console.warn("Cloudinary upload failed:", err?.message || err);
          return reject(err);
        }
        if (!result) return resolve(null);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width ?? null,
          height: result.height ?? null,
          format: result.format ?? null,
          size: result.bytes ?? null,
          folder: result.folder ?? folderPath,
        });
      }
    );
    uploadStream.end(bufferToUpload);
  });
};

// Extensions for inferring resource_type when deleting from URL
const VIDEO_EXT = "mp4|webm|mov|avi|mkv";
const RAW_EXT = "pdf|doc|docx|xls|xlsx|txt|zip";

function parseCloudinaryUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    // Match /upload/v123/... and capture path before extension
    const match = url.match(/\/upload\/v\d+\/(.+)\.([a-z0-9]+)$/i);
    if (!match) return null;
    const publicId = match[1];
    const ext = (match[2] || "").toLowerCase();
    let resourceType = "image";
    if (new RegExp(`^(${VIDEO_EXT})$`).test(ext)) resourceType = "video";
    else if (new RegExp(`^(${RAW_EXT})$`).test(ext) || ext === "pdf") resourceType = "raw";
    return { publicId, resourceType };
  } catch {
    return null;
  }
}

/**
 * Get public_id from a Cloudinary URL for creating Media/Gallery entries.
 * Returns null if URL is not a Cloudinary URL (e.g. external URLs from bulk import).
 */
export function getPublicIdFromCloudinaryUrl(url) {
  const parsed = parseCloudinaryUrl(url);
  return parsed ? parsed.publicId : null;
}

/**
 * Delete a file only if the stored value is a Cloudinary URL (image, video, or raw).
 * Non-Cloudinary URLs (e.g. old Vercel Blob URLs) are ignored so cleanup doesn't break.
 */
export const deleteFromBlobIfUrl = async (maybeUrl) => {
  if (!maybeUrl) return;
  if (!/^https?:\/\//i.test(maybeUrl)) return;

  ensureCloudinaryConfigured();

  const parsed = parseCloudinaryUrl(maybeUrl);
  if (!parsed) return;

  try {
    await cloudinary.uploader.destroy(parsed.publicId, { resource_type: parsed.resourceType });
  } catch (err) {
    console.warn("Cloudinary delete failed:", err?.message || err);
  }
};

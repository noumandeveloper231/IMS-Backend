import { v2 as cloudinary } from "cloudinary";

let cloudinaryConfigured = false;

function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured) return;

  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
  } = process.env;

  // #region agent log
  fetch("http://127.0.0.1:7501/ingest/142a21d8-3463-403b-84a8-7ee25ddfce09", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "642218",
    },
    body: JSON.stringify({
      sessionId: "642218",
      runId: "pre-fix",
      hypothesisId: "H-env",
      location: "utils/blob.js:8-20",
      message: "ensureCloudinaryConfigured env presence",
      data: {
        hasCloudName: !!CLOUDINARY_CLOUD_NAME,
        hasApiKey: !!CLOUDINARY_API_KEY,
        hasApiSecret: !!CLOUDINARY_API_SECRET,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  cloudinaryConfigured = true;
}

// Map mimetype/extension to Cloudinary resource_type: image | video | raw (PDF, docs, etc.)
function getResourceType(file) {
  const mime = (file.mimetype || "").toLowerCase();
  const name = (file.originalname || "").toLowerCase();
  if (/^video\//.test(mime) || /\.(mp4|webm|mov|avi|mkv)$/.test(name)) return "video";
  if (/^application\/pdf$/i.test(mime) || name.endsWith(".pdf")) return "raw";
  if (/^(application|text)\//.test(mime) || /\.(doc|docx|xls|xlsx|txt|zip)$/.test(name)) return "raw";
  return "image"; // default for images and unknown
}

/**
 * Upload a single file buffer (from Multer) to Cloudinary.
 * Supports images, PDFs, and other files (images + video + raw).
 * Same API as before: uploadToBlob(file, folder) -> returns URL string.
 */
export const uploadToBlob = async (file, folder) => {
  if (!file || !file.buffer) return null;

  ensureCloudinaryConfigured();

  const resourceType = getResourceType(file);
  const baseFolder = process.env.CLOUDINARY_FOLDER || "";
  const folderPath = baseFolder ? `${baseFolder}/${folder}` : folder;

  // #region agent log
  fetch("http://127.0.0.1:7501/ingest/142a21d8-3463-403b-84a8-7ee25ddfce09", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "642218",
    },
    body: JSON.stringify({
      sessionId: "642218",
      runId: "pre-fix",
      hypothesisId: "H-upload",
      location: "utils/blob.js:31-43",
      message: "uploadToBlob before cloudinary.upload_stream",
      data: {
        folder,
        folderPath,
        resourceType,
        hasBuffer: !!file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

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
    uploadStream.end(file.buffer);
  });
};

// Extensions for inferring resource_type when deleting from URL
const VIDEO_EXT = "mp4|webm|mov|avi|mkv";
const RAW_EXT = "pdf|doc|docx|xls|xlsx|txt|zip";

/**
 * Extract Cloudinary public_id and resource_type from a Cloudinary URL.
 * URL format: https://res.cloudinary.com/<cloud>/<type>/upload/v<version>/<public_id>.<ext>
 */
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

import { put, del } from "@vercel/blob";

// Upload a single file buffer from Multer to Vercel Blob
export const uploadToBlob = async (file, folder) => {
  if (!file) return null;

  const originalName = file.originalname || "file";
  const safeName = originalName.replace(/\s+/g, "_");
  const pathname = `${folder}/${Date.now()}-${safeName}`;

  const blob = await put(pathname, file.buffer, {
    access: "public",
  });

  return blob.url;
};

// Delete a blob only if the stored value looks like a full URL
export const deleteFromBlobIfUrl = async (maybeUrl) => {
  if (!maybeUrl) return;
  if (!/^https?:\/\//i.test(maybeUrl)) return;

  try {
    await del(maybeUrl);
  } catch (err) {
    // Swallow errors – storage cleanup shouldn't break main flow
    console.warn("Blob delete failed:", err?.message || err);
  }
};


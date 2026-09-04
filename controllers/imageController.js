/**
 * Download image: proxy from Cloudinary and send with Content-Disposition
 * so the browser downloads instead of displaying. Only allows Cloudinary URLs.
 */
export const downloadImage = async (req, res, next) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return res.status(400).json({ message: "Missing or invalid url query parameter" });
    }

    const url = decodeURIComponent(rawUrl.trim());
    if (!/^https:\/\/res\.cloudinary\.com\//i.test(url)) {
      return res.status(400).json({ message: "Only Cloudinary image URLs are allowed" });
    }

    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return res.status(response.status).json({ message: "Failed to fetch image" });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    let filename = (req.query.filename && typeof req.query.filename === "string")
      ? decodeURIComponent(req.query.filename.trim())
      : null;
    if (!filename) {
      const ext = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";
      filename = `image.${ext}`;
    }
    const safeName = filename.replace(/[^\w.-]/g, "_");

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
};

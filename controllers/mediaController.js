import Media from "../models/mediaModel.js";
import Brand from "../models/brandModel.js";
import Category from "../models/categoryModel.js";
import Condition from "../models/conditionModel.js";
import Product from "../models/productModel.js";
import { uploadToBlobWithMetadata } from "../utils/blob.js";
import { deleteFromBlobIfUrl } from "../utils/blob.js";

const MEDIA_FOLDER = "gallery";

/**
 * POST /media/upload
 * Batch upload: multipart/form-data with images[] (or images)
 * Uploads each to Cloudinary, saves metadata in Media collection, returns created media.
 */
export const uploadMedia = async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "No image files provided. Send as multipart/form-data with field 'images'.",
      });
    }

    const folder = (req.body && req.body.folder) || MEDIA_FOLDER;
    const created = [];

    for (const file of files) {
      const meta = await uploadToBlobWithMetadata(file, folder);
      if (!meta) continue;
      const media = await Media.create({
        url: meta.url,
        public_id: meta.public_id,
        width: meta.width,
        height: meta.height,
        format: meta.format,
        size: meta.size,
        folder: meta.folder,
        createdBy: req.user?._id || null,
      });
      created.push(media);
    }

    return res.status(200).json(created);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /media
 * List with pagination, search, folder filter.
 * Query: page, limit, search, folder
 */
export const getMedia = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const search = (req.query.search || "").toString().trim();
    const folder = (req.query.folder || "").toString().trim();
    const dateFrom = (req.query.dateFrom || "").toString().trim();
    const dateTo = (req.query.dateTo || "").toString().trim();

    const filter = { isDeleted: { $ne: true } };
    if (folder) filter.folder = folder;
    if (search) {
      filter.$or = [
        { public_id: new RegExp(search, "i") },
        { alt: new RegExp(search, "i") },
      ];
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom + "T00:00:00.000Z");
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + "T23:59:59.999Z");
    }

    const [rawItems, total] = await Promise.all([
      Media.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Media.countDocuments(filter),
    ]);

    const ids = rawItems.map((m) => m._id).filter(Boolean);
    const usedByMap = new Map(); // mediaId -> ['brand','category',...]

    if (ids.length > 0) {
      const [brandLogos, categoryImages, conditionRefs, productRefs] = await Promise.all([
        Brand.find({ logo: { $in: ids } }, { logo: 1 }).lean(),
        Category.find({ image: { $in: ids } }, { image: 1 }).lean(),
        Condition.find({ imageRef: { $in: ids } }, { imageRef: 1 }).lean(),
        Product.find(
          { $or: [{ thumbnail: { $in: ids } }, { gallery: { $in: ids } }] },
          { thumbnail: 1, gallery: 1 }
        ).lean(),
      ]);

      for (const b of brandLogos) {
        if (b.logo) usedByMap.set(b.logo.toString(), [...(usedByMap.get(b.logo.toString()) || []), "brand"]);
      }
      for (const c of categoryImages) {
        if (c.image) usedByMap.set(c.image.toString(), [...(usedByMap.get(c.image.toString()) || []), "category"]);
      }
      for (const c of conditionRefs) {
        if (c.imageRef) usedByMap.set(c.imageRef.toString(), [...(usedByMap.get(c.imageRef.toString()) || []), "condition"]);
      }
      for (const p of productRefs) {
        if (p.thumbnail) usedByMap.set(p.thumbnail.toString(), [...(usedByMap.get(p.thumbnail.toString()) || []), "product"]);
        for (const g of p.gallery || []) {
          if (g) usedByMap.set(g.toString(), [...(usedByMap.get(g.toString()) || []), "product"]);
        }
      }
    }

    const items = rawItems.map((m) => {
      const id = m._id.toString();
      const usedBy = [...new Set(usedByMap.get(id) || [])];
      return { ...m, inUse: usedBy.length > 0, usedBy };
    });

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /media/:id
 * Get single media by id.
 */
export const getMediaById = async (req, res, next) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).lean();
    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }
    return res.status(200).json(media);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /media/:id
 * Soft delete: set isDeleted = true.
 * Optionally delete from Cloudinary (query ?deleteFromCloud=1).
 */
export const deleteMedia = async (req, res, next) => {
  try {
    const media = await Media.findOne({ _id: req.params.id });
    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }

    const deleteFromCloud = req.query.deleteFromCloud === "1" || req.query.deleteFromCloud === "true";
    if (deleteFromCloud && media.url) {
      try {
        await deleteFromBlobIfUrl(media.url);
      } catch (e) {
        console.warn("Cloudinary delete failed:", e?.message);
      }
    }

    media.isDeleted = true;
    await media.save();

    return res.status(200).json({ success: true, message: "Media deleted" });
  } catch (err) {
    next(err);
  }
};

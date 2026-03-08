import Media from "../models/mediaModel.js";
import GalleryFolder from "../models/galleryFolderModel.js";
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
        folder, // use request folder path so filtering matches gallery folders
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

const MEDIA_FOLDER_DEFAULT = "gallery";

/**
 * GET /media/folders/list (or /folders - must be before /:id)
 * Returns all gallery folders: from GalleryFolder collection + distinct folder from Media.
 * Each folder created in the app is stored in DB; Cloudinary creates the folder when the first image is uploaded to that path.
 */
export const getFolders = async (req, res, next) => {
  try {
    const [savedFolders, mediaFolders] = await Promise.all([
      GalleryFolder.find().sort({ path: 1 }).lean(),
      Media.distinct("folder", { isDeleted: { $ne: true }, folder: { $exists: true, $ne: "" } }),
    ]);

    const pathSet = new Set();
    const list = [];

    for (const f of savedFolders) {
      if (f.path && !pathSet.has(f.path)) {
        pathSet.add(f.path);
        list.push({ _id: f._id, name: f.name, path: f.path, createdAt: f.createdAt });
      }
    }
    for (const path of mediaFolders || []) {
      if (path && !pathSet.has(path)) {
        pathSet.add(path);
        const base = path.split("/").pop() || path;
        const name = base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        list.push({ _id: null, name, path, createdAt: null });
      }
    }

    list.sort((a, b) => (a.path || "").localeCompare(b.path || ""));
    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /media/folders
 * Body: { name, path?, parentPath? }. If path omitted: parentPath + "/" + slug(name), or MEDIA_FOLDER + "/" + slug(name) if no parent.
 * Creates folder in DB. The folder will appear on Cloudinary when the first image is uploaded to this path.
 */
export const createFolder = async (req, res, next) => {
  try {
    let { name, path, parentPath } = req.body || {};
    name = (name || "").toString().trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Folder name is required." });
    }
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!path || typeof path !== "string" || !path.trim()) {
      const parent = (parentPath && typeof parentPath === "string") ? parentPath.trim().replace(/^\/+|\/+$/g, "") : "";
      path = parent ? `${parent}/${slug}` : (slug ? `${MEDIA_FOLDER}/${slug}` : MEDIA_FOLDER);
    } else {
      path = path.trim();
    }

    // Max depth: main folder + 3 levels of subfolders = 4 path segments
    const MAX_FOLDER_DEPTH = 4;
    const segments = path.split("/").filter(Boolean);
    if (segments.length > MAX_FOLDER_DEPTH) {
      return res.status(400).json({
        success: false,
        message: `Maximum folder depth is ${MAX_FOLDER_DEPTH} levels (main folder + 3 subfolders). Choose a parent folder that is less nested.`,
      });
    }

    const existing = await GalleryFolder.findOne({ path });
    if (existing) {
      return res.status(400).json({ success: false, message: "A folder with this path already exists." });
    }

    const folder = await GalleryFolder.create({
      name,
      path,
      createdBy: req.user?._id || null,
    });
    return res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /media/:id
 * Body: { folder }. Move media to another folder (updates DB; Cloudinary path remains unless we add rename).
 */
export const updateMedia = async (req, res, next) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }
    const folder = (req.body && req.body.folder) != null ? String(req.body.folder).trim() : null;
    if (folder !== null) {
      media.folder = folder || MEDIA_FOLDER;
      await media.save();
    }
    return res.status(200).json(media);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /media/move
 * Body: { mediaIds: string[], folder: string }. Move multiple media items to a folder.
 */
export const moveMediaToFolder = async (req, res, next) => {
  try {
    const { mediaIds, folder } = req.body || {};
    const ids = Array.isArray(mediaIds) ? mediaIds.filter((id) => id) : [];
    const targetFolder = (folder != null && String(folder).trim()) || MEDIA_FOLDER;
    if (!ids.length) {
      return res.status(400).json({ success: false, message: "mediaIds array is required." });
    }

    await Media.updateMany(
      { _id: { $in: ids }, isDeleted: { $ne: true } },
      { $set: { folder: targetFolder } }
    );
    return res.status(200).json({ success: true, message: "Media moved.", count: ids.length });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /media/copy
 * Body: { mediaIds: string[], folder: string }. Copy (duplicate) media into target folder. New Media docs point to same Cloudinary asset.
 */
export const copyMediaToFolder = async (req, res, next) => {
  try {
    const { mediaIds, folder } = req.body || {};
    const ids = Array.isArray(mediaIds) ? mediaIds.filter((id) => id) : [];
    const targetFolder = (folder != null && String(folder).trim()) || MEDIA_FOLDER;
    if (!ids.length) {
      return res.status(400).json({ success: false, message: "mediaIds array is required." });
    }

    const mediaList = await Media.find({ _id: { $in: ids }, isDeleted: { $ne: true } }).lean();
    const created = [];
    for (const m of mediaList) {
      const copy = await Media.create({
        url: m.url,
        public_id: m.public_id,
        alt: m.alt || "",
        width: m.width,
        height: m.height,
        format: m.format,
        size: m.size,
        folder: targetFolder,
        createdBy: req.user?._id || null,
      });
      created.push(copy);
    }
    return res.status(200).json({ success: true, message: "Media copied.", count: created.length, created });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /media/folders/delete?path=xxx
 * Recursively deletes the folder, all subfolders, and all media in this folder and any subfolder.
 */
export const deleteFolder = async (req, res, next) => {
  try {
    const path = (req.query.path || req.body?.path || "").toString().trim();
    if (!path) {
      return res.status(400).json({ success: false, message: "Folder path is required." });
    }

    const deleteFromCloud = req.query.deleteFromCloud === "1" || req.query.deleteFromCloud === "true";
    const pathPrefix = path.replace(/\/$/, "") + "/";

    // Delete this folder and any subfolder (path starting with pathPrefix)
    await GalleryFolder.deleteOne({ path });
    await GalleryFolder.deleteMany({ path: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } });

    // Find all media in this folder OR in any subfolder (folder === path or folder starts with pathPrefix)
    const mediaFilter = {
      isDeleted: { $ne: true },
      $or: [
        { folder: path },
        { folder: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } },
      ],
    };
    const mediaInFolder = await Media.find(mediaFilter);
    for (const m of mediaInFolder) {
      m.isDeleted = true;
      await m.save();
      if (deleteFromCloud && m.url) {
        try {
          await deleteFromBlobIfUrl(m.url);
        } catch (e) {
          console.warn("Cloudinary delete failed:", e?.message);
        }
      }
    }
    return res.status(200).json({
      success: true,
      message: "Folder, all its subfolders, and all their images have been deleted.",
      deletedMediaCount: mediaInFolder.length,
    });
  } catch (err) {
    next(err);
  }
};

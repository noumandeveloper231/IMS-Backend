import mongoose from "mongoose";
import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Subcategory from "../models/subcategoryModel.js";
import Brand from "../models/brandModel.js";
import Condition from "../models/conditionModel.js";
import Sale from "../models/saleModel.js";
import QRCode from "qrcode";
import xlsx from "xlsx";
import { uploadToBlob, deleteFromBlobIfUrl, getPublicIdFromCloudinaryUrl } from "../utils/blob.js";
import Media from "../models/mediaModel.js";
import { syncImageToGallery } from "../utils/mediaUtils.js";
import {
  getProductDependencies as getProductDependenciesService,
  checkBulkDependencies as checkBulkDependenciesService,
  bulkDeletePreview as bulkDeletePreviewService,
  executeBulkDelete as executeBulkDeleteService,
} from "../services/productBulkService.js";

// Normalize competitors coming from frontend form (array/JSON/object)
// into the object shape stored in MongoDB.
const normalizeCompetitors = (rawCompetitors, fallbackUrls = {}) => {
  const result = {};

  if (Array.isArray(rawCompetitors)) {
    rawCompetitors.forEach((c) => {
      if (c && typeof c === "object" && c.label && c.url) {
        result[c.label] = c.url;
      }
    });
  } else if (typeof rawCompetitors === "string") {
    try {
      const parsed = JSON.parse(rawCompetitors);
      if (Array.isArray(parsed)) {
        parsed.forEach((c) => {
          if (c && typeof c === "object" && c.label && c.url) {
            result[c.label] = c.url;
          }
        });
      } else if (parsed && typeof parsed === "object") {
        Object.entries(parsed).forEach(([key, value]) => {
          if (typeof value === "string" && value) {
            result[key] = value;
          }
        });
      }
    } catch {
      // ignore JSON parse errors, fall back to URLs below
    }
  } else if (rawCompetitors && typeof rawCompetitors === "object") {
    Object.entries(rawCompetitors).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        result[key] = value;
      }
    });
  }

  const { amazonUrl, noonUrl, sharafdgUrl, carrefourUrl } = fallbackUrls;
  if (amazonUrl) result.Amazon = amazonUrl;
  if (noonUrl) result.Noon = noonUrl;
  if (sharafdgUrl) result.SharafDG = sharafdgUrl;
  if (carrefourUrl) result.Carrefour = carrefourUrl;

  return result;
};

// Normalize ourMarketplace (same shape as competitors: array of { label, url } → object label: url), max 6
const normalizeOurMarketplace = (raw) => {
  const result = {};
  if (Array.isArray(raw)) {
    raw.slice(0, 6).forEach((c) => {
      if (c && typeof c === "object" && c.label && c.url) {
        result[c.label] = c.url;
      }
    });
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.slice(0, 6).forEach((c) => {
          if (c && typeof c === "object" && c.label && c.url) {
            result[c.label] = c.url;
          }
        });
      } else if (parsed && typeof parsed === "object") {
        Object.entries(parsed)
          .slice(0, 6)
          .forEach(([key, value]) => {
            if (typeof value === "string" && value) result[key] = value;
          });
      }
    } catch {}
  } else if (raw && typeof raw === "object") {
    Object.entries(raw)
      .slice(0, 6)
      .forEach(([key, value]) => {
        if (typeof value === "string" && value) result[key] = value;
      });
  }
  return result;
};

/**
 * Add product image URLs to the Gallery (Media collection) with generated alt text.
 * Only processes Cloudinary URLs; skips duplicates (by url).
 * Alt: single image = sku, multiple = sku-image-1, sku-image-2, ...
 * Returns the IDs of the created or existing Media records.
 */
const addProductImagesToGallery = async (sku, imageUrls, userId = null) => {
  if (!sku || !Array.isArray(imageUrls) || imageUrls.length === 0) return [];
  const urls = imageUrls.filter((u) => typeof u === "string" && u.trim());
  if (!urls.length) return [];

  const MEDIA_FOLDER = "gallery";
  const mediaIds = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();
    const publicId = getPublicIdFromCloudinaryUrl(url);
    if (!publicId) continue; 

    let media = await Media.findOne({ url, isDeleted: { $ne: true } });
    if (!media) {
      const alt = urls.length === 1 ? sku : `${sku}-image-${i + 1}`;
      media = await Media.create({
        url,
        public_id: publicId,
        alt,
        folder: MEDIA_FOLDER,
        createdBy: userId,
      });
    }
    if (media) mediaIds.push(media._id);
  }
  return mediaIds;
};

// ✅ Upload product image only (returns URL for use in bulk import etc.)
export const uploadProductImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }
    const imageUrl = await uploadToBlob(req.file, "products");
    res.status(200).json({
      success: true,
      url: imageUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upload image" + error.message,
      error: error.message,
    });
    console.log(error.message);
  }
};

// ✅ Delete product image from blob by URL (for import: replace image from device)
export const deleteProductImageByUrl = async (req, res) => {
  try {
    const { imageUrl } = req.body || {};
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      return res.status(400).json({
        success: false,
        message: "Valid image URL required",
      });
    }
    await deleteFromBlobIfUrl(imageUrl);
    res.status(200).json({ success: true, message: "Image removed" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete image",
      error: error.message,
    });
  }
};

/** ASIN format: B0 + 8 alphanumeric (e.g. B0A4X7T2LQ). Ensures no duplicate in products. */
const ASIN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomAsinSuffix(length = 8) {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += ASIN_CHARS.charAt(Math.floor(Math.random() * ASIN_CHARS.length));
  }
  return s;
}

export const generateAsin = async (req, res) => {
  try {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      const asin = "B0" + randomAsinSuffix(8);
      const existing = await Product.findOne({ asin }).lean();
      if (!existing) {
        return res.status(200).json({ success: true, asin });
      }
    }
    return res.status(500).json({
      success: false,
      message: "Could not generate a unique ASIN. Please try again.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to generate ASIN",
    });
  }
};

// Create Product
export const createProduct = async (req, res) => {
  try {
    const {
      title,
      sku,
      asin,
      purchasePrice,
      salePrice,
      quantity,
      description,
      specification,
      modelno,
      category,
      subcategory,
      brand,
      condition,
      returnable,
      competitors,
      ourMarketplace,
      amazonUrl,
      noonUrl,
      sharafdgUrl,
      carrefourUrl,
      thumbnailId,
      galleryIds,
    } = req.body;

    console.log("req.body in createProduct", req.body);

    const skuExists = await Product.findOne({ sku });
    if (skuExists) {
      return res.status(400).json({
        success: false,
        message: "❌ SKU already exists",
      });
    }

    // ✅ SKU se QR generate karna
    // const qrCode = await QRCode.toDataURL(sku);

    // ✅ SKU se QR generate karna
    const qrCode = await QRCode.toDataURL(sku);

    // ✅ Media Library: thumbnailId + galleryIds, or legacy file upload
    let thumbnail = null;
    let gallery = [];
    let image = null;
    let uploadedImages = [];
    if (thumbnailId && mongoose.Types.ObjectId.isValid(thumbnailId)) {
      thumbnail = thumbnailId;
    }
    if (Array.isArray(galleryIds) && galleryIds.length) {
      gallery = galleryIds.filter((id) => id && mongoose.Types.ObjectId.isValid(id));
    }
    if (gallery.length === 0 && typeof req.body.galleryIds === "string") {
      try {
        const parsed = JSON.parse(req.body.galleryIds);
        if (Array.isArray(parsed)) {
          gallery = parsed.filter((id) => id && mongoose.Types.ObjectId.isValid(id));
        }
      } catch (_) {}
    }
    if (!thumbnail && gallery.length === 0) {
      if (Array.isArray(req.files) && req.files.length > 0) {
        const imageFiles = req.files.filter(
          (file) => file.fieldname === "images" || file.fieldname === "image"
        );
        if (imageFiles.length > 0) {
          uploadedImages = await Promise.all(
            imageFiles.map((file) => uploadToBlob(file, "products"))
          );
        }
      } else if (req.file) {
        const singleImage = await uploadToBlob(req.file, "products");
        if (singleImage) uploadedImages = [singleImage];
      }
      image = uploadedImages[0] || null;
    }

    const returnableVal =
      returnable === "false" || returnable === false ? false : true;

    const competitorsObj = normalizeCompetitors(competitors, {
      amazonUrl,
      noonUrl,
      sharafdgUrl,
      carrefourUrl,
    });
    const ourMarketplaceObj = normalizeOurMarketplace(ourMarketplace);

    const product = new Product({
      title,
      sku,
      asin,
      purchasePrice,
      salePrice,
      quantity,
      description,
      specification,
      modelno,
      category: category || null,
      subcategory: subcategory || null,
      brand,
      condition,
      returnable: returnableVal,
      qrCode,
      thumbnail: thumbnail || undefined,
      gallery: gallery.length ? gallery : undefined,
      image,
      images: uploadedImages,
      competitors: competitorsObj,
      ourMarketplace: ourMarketplaceObj,
    });

    await product.save();

    // Add uploaded product images to Gallery (Media) with generated alt text
    if (uploadedImages && uploadedImages.length > 0) {
      try {
        const syncedIds = await addProductImagesToGallery(product.sku, uploadedImages, req.user?._id);
        if (syncedIds && syncedIds.length > 0) {
          if (!product.thumbnail) product.thumbnail = syncedIds[0];
          if (!product.gallery || product.gallery.length === 0) product.gallery = syncedIds;
          await product.save();
        }
      } catch (galleryErr) {
        console.warn("Gallery sync after product create:", galleryErr?.message || galleryErr);
      }
    }

    const created = await Product.findById(product._id)
      .populate("thumbnail")
      .populate("gallery")
      .lean();
    if (created) {
      created.image = created.thumbnail?.url || created.image;
      created.images = (created.gallery && created.gallery.map((m) => m?.url).filter(Boolean)) || created.images || [];
    }
    res.status(201).json({
      success: true,
      message: "Product created successfully ✅",
      product: created || product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /products/check-skus — return which SKUs already exist in DB (for bulk import validation) */
export const checkSkus = async (req, res) => {
  try {
    const { skus } = req.body;
    if (!Array.isArray(skus) || skus.length === 0) {
      return res.status(200).json({ existing: [] });
    }
    const trimmed = [...new Set(skus.map((s) => String(s ?? "").trim()).filter(Boolean))];
    const existing = await Product.find({ sku: { $in: trimmed } })
      .select("sku")
      .lean();
    const existingList = existing.map((p) => p.sku);
    res.status(200).json({ existing: existingList });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check SKUs",
      error: error.message,
    });
  }
};

export const bulkCreateProducts = async (req, res) => {
  try {
    const products = req.body; // Array of products [{title, sku, ...}, ...]

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No products provided",
      });
    }

    // 🔹 Fetch all categories, subcategories, brands, conditions once for efficiency
    const [categoriesList, subcategoriesList, brandsList, conditionsList] = await Promise.all([
      Category.find().select("name _id").lean(),
      Subcategory.find().select("name _id category").lean(),
      Brand.find().select("name _id").lean(),
      Condition.find().select("name _id").lean(),
    ]);

    const newProducts = [];

    for (const item of products) {
      // 🔍 Duplicate check: use SKU only (generated from ASIN+Condition on frontend)
      const existingProduct = await Product.findOne({ sku: item.sku });
      if (existingProduct) {
        continue;
      }

      // 🔹 Resolve id from value: accept MongoDB ObjectId (24 hex) or name
      const resolveId = (list, value) => {
        if (!value) return null;
        const str = Array.isArray(value) ? value[0] : String(value).split(",")[0].trim();
        if (!str) return null;
        if (/^[a-fA-F0-9]{24}$/.test(str)) {
          const byId = list.find((x) => String(x._id) === str);
          return byId ? byId._id : null;
        }
        const byName = list.find((x) => (x.name || "").trim() === str);
        return byName ? byName._id : null;
      };

      // 🔹 Category (accept category/categories/Categories from payload)
      const categoryRaw = item.category ?? item.categories ?? item.Categories;
      let categoryId = resolveId(categoriesList, categoryRaw);

      // 🔹 Subcategory (optional)
      const subcategoryRaw = item.subcategory ?? item.subcategories ?? item.Subcategories;
      let subcategoryId = resolveId(subcategoriesList, subcategoryRaw) || null;

      // 🔹 Brand
      const brandRaw = item.brand ?? item.brands ?? item.Brands;
      let brandId = resolveId(brandsList, brandRaw);

      // 🔹 Condition
      const conditionRaw = item.condition ?? item.conditions ?? item.Conditions;
      let conditionId = resolveId(conditionsList, conditionRaw);

      // 🔹 QR Code generate karein
      const qrCode = await QRCode.toDataURL(item.sku);

      if (!brandId || !conditionId) continue;

      const rawReturnable = item.returnable ?? item.refundable;
      const returnableVal =
        rawReturnable === "false" || rawReturnable === false ? false : true;

      // ✅ Support multiple images coming from bulk import
      const imagesArray = Array.isArray(item.images)
        ? item.images.filter((img) => typeof img === "string" && img)
        : item.image
        ? [item.image]
        : [];

      newProducts.push({
        title: item.title,
        sku: item.sku,
        asin: item.asin || null,
        purchasePrice: item.purchasePrice,
        salePrice: item.salePrice,
        quantity: item.quantity || 0,
        description: item.description,
        specification: item.specification,
        modelno: item.modelno,
        category: categoryId,
        subcategory: subcategoryId,
        brand: brandId,
        condition: conditionId,
        returnable: returnableVal,
        qrCode,
        image: imagesArray[0] || null,
        images: imagesArray,
      });
    }

    if (newProducts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No new products to insert (maybe duplicates)",
      });
    }

    const inserted = await Product.insertMany(newProducts);

    // Add each product's images to Gallery (Media) with generated alt text
    for (const product of inserted) {
      const images = Array.isArray(product.images)
        ? product.images.filter((img) => typeof img === "string" && img)
        : product.image
          ? [product.image]
          : [];
      if (images.length > 0 && product.sku) {
        try {
          await addProductImagesToGallery(product.sku, images);
        } catch (galleryErr) {
          console.warn(`Gallery sync for product ${product.sku}:`, galleryErr?.message || galleryErr);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `${newProducts.length} products imported successfully ✅`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to import products",
      error: error.message,
    });
  }
};
//// Bulk Import Products from Excel  //
// Bulk Import Products from Excel
export const bulkImportProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // ✅ Excel file parse karo (memory buffer se, disk nahi)
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    let importedItems = [];

    for (let row of rows) {
      const { title, asin, orderedQty, purchasePrice } = row;

      if (!asin || !title || !purchasePrice || !orderedQty) {
        continue; // required fields skip karo agar missing hai
      }

      // ✅ Quantity ke hisaab se multiple PO rows banao
      for (let i = 0; i < orderedQty; i++) {
        importedItems.push({
          title,
          asin,
          orderedQty: 1,
          purchasePrice,
          total: purchasePrice * 1,
          status: "pending",
        });
      }
    }

    // ✅ Response
    res.json({
      success: true,
      message: "PO file imported successfully. Products not yet created.",
      items: importedItems, // frontend table display ke liye
    });
  } catch (err) {
    console.error("Bulk import error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get All Products
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("brand")
      .populate("condition")
      .populate("category")
      .populate("subcategory")
      .populate("thumbnail")
      .populate("gallery");
    const withImageUrls = products.map((p) => {
      const doc = p.toObject ? p.toObject() : p;
      doc.image = doc.thumbnail?.url || doc.image;
      doc.images = (doc.gallery && doc.gallery.length > 0 && doc.gallery.map((m) => m?.url).filter(Boolean)) || doc.images || [];
      return doc;
    });
    res.status(200).json({
      success: true,
      count: withImageUrls.length,
      products: withImageUrls,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Product
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("brand")
      .populate("condition")
      .populate("category")
      .populate("subcategory")
      .populate("thumbnail")
      .populate("gallery");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const doc = product.toObject ? product.toObject() : product;
    doc.image = doc.thumbnail?.url || doc.image;
    doc.images = (doc.gallery && doc.gallery.length > 0 && doc.gallery.map((m) => m?.url).filter(Boolean)) || doc.images || [];
    res.status(200).json({ success: true, product: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      sku,
      asin,
      purchasePrice,
      salePrice,
      quantity,
      description,
      specification,
      amazonUrl,
      noonUrl,
      sharafdgUrl,
      carrefourUrl,
      modelno,
      category,
      subcategory,
      brand,
      condition,
      returnable,
      competitors,
      ourMarketplace,
      existingImages,
      thumbnailId,
      galleryIds,
    } = req.body;

    let galleryIdsArr = galleryIds;
    if (typeof galleryIdsArr === "string") {
      try {
        galleryIdsArr = JSON.parse(galleryIdsArr);
      } catch (_) {
        galleryIdsArr = [];
      }
    }
    if (!Array.isArray(galleryIdsArr)) galleryIdsArr = [];

    // 🔍 Duplicate check: SKU ya ModelNo already exist karta hai?
    const existingProduct = await Product.findOne({
      $or: [{ sku }],
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "❌ SKUalready exists",
      });
    }

    // 🔍 Pehle current product fetch kar lein (purani image delete/update ke liye)
    const currentProduct = await Product.findById(id);
    if (!currentProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found ❌" });
    }

    // ✅ existingImages (order & which ones to keep) ko parse karein (agar frontend se aaye)
    let hasExistingImagesField = false;
    let existingImagesOrder = [];
    if (typeof existingImages !== "undefined") {
      hasExistingImagesField = true;
      try {
        const parsed =
          typeof existingImages === "string" ? JSON.parse(existingImages) : existingImages;
        if (Array.isArray(parsed)) {
          existingImagesOrder = parsed.filter((img) => typeof img === "string" && img);
        }
      } catch (e) {
        console.error("Failed to parse existingImages in updateProduct:", e?.message || e);
        existingImagesOrder = [];
      }
    }

    // ✅ Agar new image(s) upload hui hain
    let uploadedImages = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      const imageFiles = req.files.filter(
        (file) => file.fieldname === "images" || file.fieldname === "image"
      );
      if (imageFiles.length > 0) {
        uploadedImages = await Promise.all(
          imageFiles.map((file) => uploadToBlob(file, "products"))
        );
      }
    } else if (req.file) {
      const singleImage = await uploadToBlob(req.file, "products");
      if (singleImage) {
        uploadedImages = [singleImage];
      }
    }

    // ✅ Agar SKU update hua hai to naya QR generate karein
    let qrCode;
    if (sku) {
      qrCode = await QRCode.toDataURL(sku);
    }

    const returnableVal =
      returnable === "false" || returnable === false ? false : true;

    const competitorsObj = normalizeCompetitors(competitors, {
      amazonUrl: amazonUrl || currentProduct.competitors?.Amazon,
      noonUrl: noonUrl || currentProduct.competitors?.Noon,
      sharafdgUrl: sharafdgUrl || currentProduct.competitors?.SharafDG,
      carrefourUrl: carrefourUrl || currentProduct.competitors?.Carrefour,
    });
    const ourMarketplaceObj = normalizeOurMarketplace(ourMarketplace);

    // 🔁 Final images array tayar karein (order + additions)
    let finalImages;
    if (hasExistingImagesField) {
      // Frontend ne explicitly bataya hai kaun si purani images rakhni hain (aur kis order me)
      finalImages = [...existingImagesOrder];
    } else if (Array.isArray(currentProduct.images) && currentProduct.images.length) {
      finalImages = [...currentProduct.images];
    } else if (currentProduct.image) {
      finalImages = [currentProduct.image];
    } else {
      finalImages = [];
    }

    if (uploadedImages && uploadedImages.length) {
      // Nayi images ko end me append karein (UI me order support simple rahega)
      finalImages = [...finalImages, ...uploadedImages];
    }

    // ❌ Sirf un purani images ko delete karein jo ab final list me nahi hain
    if (hasExistingImagesField) {
      const originalImages = [
        ...(Array.isArray(currentProduct.images) ? currentProduct.images : []),
      ];
      if (currentProduct.image && !originalImages.includes(currentProduct.image)) {
        originalImages.push(currentProduct.image);
      }

      const imagesToDelete = originalImages.filter(
        (img) => img && !finalImages.includes(img)
      );

      for (const img of imagesToDelete) {
        await deleteFromBlobIfUrl(img);
      }
    }

    const updateData = {
      title,
      sku,
      asin,
      purchasePrice,
      salePrice,
      quantity,
      description,
      specification,
      modelno,
      category: category || null,
      subcategory: subcategory || null,
      brand,
      condition,
      returnable: returnableVal,
      competitors: competitorsObj,
      ourMarketplace: ourMarketplaceObj,
      ...(qrCode && { qrCode }),
    };
    if (
      thumbnailId !== undefined ||
      (Array.isArray(galleryIdsArr) && galleryIdsArr.length > 0)
    ) {
      updateData.thumbnail =
        thumbnailId && mongoose.Types.ObjectId.isValid(thumbnailId) ? thumbnailId : null;
      updateData.gallery = Array.isArray(galleryIdsArr)
        ? galleryIdsArr.filter((id) => id && mongoose.Types.ObjectId.isValid(id))
        : [];
      updateData.image = null;
      updateData.images = [];
    } else {
      updateData.images = finalImages;
      updateData.image = finalImages[0] || null;
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("category")
      .populate("subcategory")
      .populate("brand")
      .populate("condition")
      .populate("thumbnail")
      .populate("gallery");

    // Add newly uploaded images to Gallery (Media) with generated alt text
    if (uploadedImages && uploadedImages.length > 0 && product.sku) {
      try {
        const syncedIds = await addProductImagesToGallery(product.sku, uploadedImages, req.user?._id);
        if (syncedIds && syncedIds.length > 0) {
          if (!product.thumbnail) product.thumbnail = syncedIds[0];
          // Append new images to gallery if it's already using media library
          if (Array.isArray(product.gallery) && product.gallery.length > 0) {
            product.gallery = [...product.gallery, ...syncedIds];
          } else if (!product.gallery || product.gallery.length === 0) {
            product.gallery = syncedIds;
          }
          await product.save();
        }
      } catch (galleryErr) {
        console.warn("Gallery sync after product update:", galleryErr?.message || galleryErr);
      }
    }

    const doc = product.toObject ? product.toObject() : product;
    doc.image = doc.thumbnail?.url || doc.image;
    doc.images = (doc.gallery && doc.gallery.length > 0 && doc.gallery.map((m) => m?.url).filter(Boolean)) || doc.images || [];

    res.status(200).json({
      success: true,
      message: "Product updated successfully ✅",
      product: doc,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get products by brand, category, condition, stock
export const getProductsByFilter = async (req, res) => {
  try {
    const { type, id } = req.params; // type = brand | category | condition | stock
    let filter = {};

    if (type === "brand") filter.brand = id;
    else if (type === "category") filter.category = id;
    else if (type === "condition") filter.condition = id;
    else if (type === "stock") {
      if (id === "in-stock") filter.quantity = { $gt: 0 };
      else if (id === "out-of-stock") filter.quantity = 0;
    }

    const products = await Product.find(filter)
      .populate("category", "name")
      .populate("subcategory")
      .populate("brand", "name")
      .populate("condition", "name")
      .populate("thumbnail")
      .populate("gallery");

    const withImageUrls = products.map((p) => {
      const doc = p.toObject ? p.toObject() : p;
      doc.image = doc.thumbnail?.url || doc.image;
      doc.images = (doc.gallery && doc.gallery.length > 0 && doc.gallery.map((m) => m?.url).filter(Boolean)) || doc.images || [];
      return doc;
    });
    res.status(200).json({ success: true, products: withImageUrls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ✅ Get products by stock status
export const getProductsByFilterStock = async (req, res) => {
  try {
    const { status } = req.params;
    let query = {};
    console.log(status);

    if (status === "in-stock") {
      query.quantity = { $gt: 0 };
    } else if (status === "out-of-stock") {
      query.quantity = 0;
    }

    const products = await Product.find(query)
      .populate("brand category subcategory condition")
      .populate("thumbnail")
      .populate("gallery");

    const withImageUrls = products.map((p) => {
      const doc = p.toObject ? p.toObject() : p;
      doc.image = doc.thumbnail?.url || doc.image;
      doc.images = (doc.gallery && doc.gallery.length > 0 && doc.gallery.map((m) => m?.url).filter(Boolean)) || doc.images || [];
      return doc;
    });
    res.json({ success: true, products: withImageUrls });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching products" });
  }
};

// ========== Product dependencies & bulk delete (like Categories) ==========

export const getProductDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getProductDependenciesService(id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error.message?.includes("not found") || error.message?.includes("Invalid") ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Failed to get product dependencies",
      error: error.message,
    });
  }
};

export const checkBulkDependencies = async (req, res) => {
  try {
    const { productIds } = req.body;
    const result = await checkBulkDependenciesService(productIds);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error.message?.includes("not found") || error.message?.includes("Invalid") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Failed to check bulk dependencies",
      error: error.message,
    });
  }
};

export const bulkDeletePreview = async (req, res) => {
  try {
    const { productIds } = req.body;
    const result = await bulkDeletePreviewService(productIds);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error.message?.includes("not found") || error.message?.includes("Invalid") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Bulk delete preview failed",
      error: error.message,
    });
  }
};

export const bulkDelete = async (req, res) => {
  try {
    const { productIds } = req.body;
    const result = await executeBulkDeleteService(productIds);
    res.status(200).json(result);
  } catch (error) {
    const status = error.message?.includes("not found") || error.message?.includes("Invalid") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Bulk delete failed",
      error: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const cascade = req.query.cascade === "true";

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const salesUsingProduct = await Sale.find({ "items.product": id });
    if (salesUsingProduct.length > 0 && !cascade) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete product because it is linked to one or more orders. Use cascade to remove from orders and delete.",
      });
    }

    if (cascade && salesUsingProduct.length > 0) {
      for (const sale of salesUsingProduct) {
        const remainingItems = sale.items.filter(
          (item) => item.product && item.product.toString() !== id
        );
        const subTotal = remainingItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0);
        const totalCOGS = remainingItems.reduce(
          (sum, it) => sum + (Number(it.purchasePrice) || 0) * (Number(it.quantity) || 0),
          0
        );
        sale.items = remainingItems;
        sale.subTotal = subTotal;
        sale.COGS = totalCOGS;
        sale.grandTotal =
          subTotal + Number(sale.vat || 0) + Number(sale.shipping || 0) - Number(sale.discount || 0);
        sale.profit = sale.grandTotal - totalCOGS;
        await sale.save();
      }
    }

    if (Array.isArray(product.images)) {
      for (const img of product.images) {
        if (img) {
          await deleteFromBlobIfUrl(img);
        }
      }
    }
    if (product.image) {
      await deleteFromBlobIfUrl(product.image);
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: cascade && salesUsingProduct.length > 0
        ? "Product removed from orders and deleted successfully"
        : "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

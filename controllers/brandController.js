import mongoose from "mongoose";
import Brand from "../models/brandModel.js";
import Product from "../models/productModel.js";
import { uploadToBlob, deleteFromBlobIfUrl } from "../utils/blob.js";
import {
  checkBulkDependencies as checkBulkDependenciesService,
  bulkDeletePreview as bulkDeletePreviewService,
  executeBulkDelete as executeBulkDeleteService,
} from "../services/brandBulkService.js";

// ✅ Upload brand image only (returns URL for use in bulk import etc.)
export const uploadBrandImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }
    const imageUrl = await uploadToBlob(req.file, "brands");
    res.status(200).json({
      success: true,
      url: imageUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
};

// ✅ Delete brand image from blob by URL (for import: replace image from device)
export const deleteBrandImageByUrl = async (req, res) => {
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

export const createBrand = async (req, res) => {
  try {
    let { name, logo: logoId } = req.body;
    if (typeof logoId === "string") logoId = logoId.trim();
    if (Array.isArray(logoId)) logoId = logoId[0];
    let logoRef = null;
    let imageUrl = null;
    if (logoId && mongoose.Types.ObjectId.isValid(logoId)) {
      logoRef = logoId;
    } else if (req.file) {
      imageUrl = await uploadToBlob(req.file, "brands");
    }

    const existingBrand = await Brand.findOne({ name: name?.trim() });
    if (existingBrand) {
      return res.json({
        success: false,
        message: "This Brand already exists!",
      });
    }

    const newBrand = new Brand({
      name: name?.trim(),
      logo: logoRef,
      image: imageUrl || undefined,
    });
    await newBrand.save();

    const populated = await Brand.findById(newBrand._id).populate("logo").lean();
    const payload = populated ? { ...populated, imageUrl: populated.logo?.url || populated.image } : newBrand;
    res.json({
      success: true,
      message: "Brand created successfully",
      Brand: payload,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create Brand",
      error: error.message,
    });
  }
};

// New function for bulk brand creation
export const createBulkBrands = async (req, res) => {
  try {
    const brandsData = req.body; // An array of brand objects from the Excel file

    const createdBrands = [];
    for (const brandData of brandsData) {
      const { name, image } = brandData;

      const existingBrand = await Brand.findOne({ name: name.trim() });
      if (existingBrand) {
        // console.log(`Brand already exists, skipping: ${name}`);
        continue; // Skip to the next item
      }

      const newBrand = new Brand({
        name: name.trim(),
        image, // bulk: legacy URL
      });
      await newBrand.save();
      createdBrands.push(newBrand);
    }

    res.json({
      success: true,
      message: `${createdBrands.length} brands created successfully`,
      brands: createdBrands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create brands in bulk",
      error: error.message,
    });
  }
};
// ✅ Get all brands
export const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find().populate("logo").lean();
    const withUrl = brands.map((b) => ({
      ...b,
      imageUrl: b.logo?.url || b.image,
    }));
    res.status(200).json({
      success: true,
      brands: withUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
      error: error.message,
    });
  }
};
// ✅ Get all brands with product count
export const getBrandsCount = async (req, res) => {
  try {
    const brands = await Brand.aggregate([
      {
        $addFields: {
          logoId: {
            $cond: [
              { $eq: [{ $type: "$logo" }, "string"] },
              { $toObjectId: "$logo" },
              "$logo",
            ],
          },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "brand",
          as: "products",
        },
      },
      {
        $lookup: {
          from: "media",
          let: { lid: "$logoId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$lid"] } } },
            { $project: { url: 1 } },
          ],
          as: "logoDocMedia",
        },
      },
      {
        $lookup: {
          from: "medias",
          let: { lid: "$logoId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$lid"] } } },
            { $project: { url: 1 } },
          ],
          as: "logoDocMedias",
        },
      },
      {
        $addFields: {
          logoDoc: {
            $cond: {
              if: { $gt: [{ $size: "$logoDocMedia" }, 0] },
              then: "$logoDocMedia",
              else: "$logoDocMedias",
            },
          },
        },
      },
      {
        $addFields: {
          productCount: { $size: "$products" },
          imageUrl: {
            $cond: {
              if: { $gt: [{ $size: "$logoDoc" }, 0] },
              then: { $arrayElemAt: ["$logoDoc.url", 0] },
              else: "$image",
            },
          },
        },
      },
      {
        $project: {
          products: 0,
          logoDoc: 0,
          logoDocMedia: 0,
          logoDocMedias: 0,
          logoId: 0,
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    // #region agent log
    const withLogo = brands.filter((b) => b.logo);
    const missingImageUrl = brands.filter((b) => b.logo && !b.imageUrl && !b.image);
    const sample = withLogo[0] || brands[0];
    if (sample) {
      fetch('http://127.0.0.1:7822/ingest/e80cfdd2-dd48-4002-adf0-6ed47d0de637',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7dec65'},body:JSON.stringify({sessionId:'7dec65',runId:'getBrandsCount',hypothesisId:'H6',location:'brandController.js:getBrandsCount',message:'getBrandsCount sample brand',data:{name:sample.name,logo:sample.logo,logoType:typeof sample.logo,imageUrl:sample.imageUrl,image:sample.image,withLogoCount:withLogo.length,totalCount:brands.length},timestamp:Date.now()})}).catch(()=>{});
    }
    if (missingImageUrl.length > 0) {
      fetch('http://127.0.0.1:7822/ingest/e80cfdd2-dd48-4002-adf0-6ed47d0de637',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7dec65'},body:JSON.stringify({sessionId:'7dec65',runId:'getBrandsCount',hypothesisId:'H6',location:'brandController.js:getBrandsCount',message:'brands with logo but no imageUrl',data:{count:missingImageUrl.length,brands:missingImageUrl.map((b)=>({name:b.name,id:b._id,logo:b.logo}))},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion agent log

    res.status(200).json({
      success: true,
      brands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve brands",
      error: error.message,
    });
  }
};

// ✅ Get brand dependencies (products count)
export const getBrandDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }
    const productsCount = await Product.countDocuments({ brand: id });
    res.status(200).json({
      success: true,
      productsCount: productsCount || 0,
      hasDependencies: (productsCount || 0) > 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get brand dependencies",
      error: error.message,
    });
  }
};

// ✅ Transfer brand dependencies to another brand (move product links), then delete
export const transferBrandDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const { transferToBrandId } = req.body;
    if (!transferToBrandId) {
      return res.status(400).json({
        success: false,
        message: "transferToBrandId is required",
      });
    }
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }
    const targetBrand = await Brand.findById(transferToBrandId);
    if (!targetBrand || targetBrand._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "Target brand not found or cannot transfer to same brand",
      });
    }
    const brandObjId = new mongoose.Types.ObjectId(id);
    const targetObjId = new mongoose.Types.ObjectId(transferToBrandId);
    await Product.updateMany(
      { brand: brandObjId },
      { $set: { brand: targetObjId } }
    );
    if (brand.image) {
      await deleteFromBlobIfUrl(brand.image);
    }
    await Brand.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Dependencies transferred and brand deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to transfer dependencies " + error.message,
      error: error.message,
    });
  }
};

// ✅ Get brand by ID
export const getBrandById = async (req, res) => {
  try {
    const id = req.params.id;
    const userExist = await Brand.findById(id).populate("logo").lean();
    if (!userExist) {
      return res.status(404).json({ msg: "Brand not found" });
    }
    const withUrl = { ...userExist, imageUrl: userExist.logo?.url || userExist.image };
    res.status(200).json(withUrl);
  } catch (error) {
    console.log(req.params.id);
    res.status(500).json({ error: error });
  }
};
// ✅ Update brand by ID
export const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, logo: logoId } = req.body;
    if (typeof logoId === "string") logoId = logoId.trim();
    if (Array.isArray(logoId)) logoId = logoId[0];
    const newImageUrl = req.file ? await uploadToBlob(req.file, "brands") : null;

    const duplicate = await Brand.findOne({
      name: name?.trim(),
      _id: { $ne: id },
    });
    if (duplicate) {
      return res.json({
        success: false,
        message: "This Brand already exists!",
      });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.json({
        success: false,
        message: "Brand not found!",
      });
    }

    if (newImageUrl && brand.image) {
      await deleteFromBlobIfUrl(brand.image);
    }

    brand.name = name?.trim();
    if (logoId !== undefined) {
      brand.logo = logoId && mongoose.Types.ObjectId.isValid(logoId) ? logoId : null;
    }
    if (newImageUrl) {
      brand.image = newImageUrl;
      brand.logo = null;
    }
    await brand.save();

    const populated = await Brand.findById(brand._id).populate("logo").lean();
    const withUrl = populated ? { ...populated, imageUrl: populated.logo?.url || populated.image } : brand;
    res.json({
      success: true,
      message: "Brand updated successfully",
      brand: withUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update Brand",
      error: error.message,
    });
  }
};
// ✅ Delete brand by ID (with optional cascade: unlink from products)
export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const cascade = req.query.cascade === "true";
    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    if (cascade) {
      const products = await Product.find({ brand: id });
      for (const product of products) {
        if (Array.isArray(product.images)) {
          for (const img of product.images) {
            if (img) await deleteFromBlobIfUrl(img);
          }
        }
        if (product.image) await deleteFromBlobIfUrl(product.image);
        await Product.findByIdAndDelete(product._id);
      }
    } else {
      const productCount = await Product.countDocuments({ brand: id });
      if (productCount > 0) {
        return res.status(409).json({
          success: false,
          message: "Brand has linked products. Use cascade or transfer.",
          productsCount: productCount,
        });
      }
    }

    if (brand.image) {
      await deleteFromBlobIfUrl(brand.image);
    }

    await Brand.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete brand",
      error: error.message,
    });
  }
};

// ========== Bulk dependency & delete ==========

/**
 * POST /brands/check-bulk-dependencies
 * Body: { brandIds: string[] }
 * Returns: { operationId, summary: { total, noDeps, needsResolution }, items: [...] }
 */
export const checkBulkDependencies = async (req, res) => {
  try {
    const { brandIds } = req.body;
    const result = await checkBulkDependenciesService(brandIds);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status =
      error.message?.includes("not found") || error.message?.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Failed to check bulk dependencies",
      error: error.message,
    });
  }
};

/**
 * POST /brands/bulk-delete-preview
 * Body: { brandIds: string[], resolutionPlan: { id, action, transferTo? }[] }
 * Returns: { summary, brands } (simulation, no commit)
 */
export const bulkDeletePreview = async (req, res) => {
  try {
    const { brandIds, resolutionPlan } = req.body;
    const result = await bulkDeletePreviewService(brandIds, resolutionPlan);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status =
      error.message?.includes("not found") || error.message?.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Bulk delete preview failed",
      error: error.message,
    });
  }
};

/**
 * POST /brands/bulk-delete
 * Body: { brandIds: string[], resolutionPlan: { id, action, transferTo? }[] }
 */
export const bulkDelete = async (req, res) => {
  try {
    const { brandIds, resolutionPlan } = req.body;
    const result = await executeBulkDeleteService(brandIds, resolutionPlan);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status =
      error.message?.includes("not found") ||
      error.message?.includes("Invalid") ||
      error.message?.includes("cannot be in the delete list")
        ? 400
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Bulk delete failed",
      error: error.message,
    });
  }
};

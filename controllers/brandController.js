// controllers/brandController.js
import mongoose from "mongoose";
import Brand from "../models/brandModel.js";
import Product from "../models/productModel.js";
import { uploadToBlob, deleteFromBlobIfUrl } from "../utils/blob.js";

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
    const { name } = req.body;

    const image = req.file ? await uploadToBlob(req.file, "brands") : null;

    const existingBrand = await Brand.findOne({ name: name.trim() });
    if (existingBrand) {
      return res.json({
        success: false,
        message: "This Brand already exists!",
      });
    }

    const newBrand = new Brand({
      name: name.trim(),
      image,
    });
    await newBrand.save();

    res.json({
      success: true,
      message: "Brand created successfully",
      Brand: newBrand,
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
        image, // The image path is directly available here
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
    const brands = await Brand.find();
    res.status(200).json({
      success: true,
      brands,
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
        $lookup: {
          from: "products", // products collection ka naam
          localField: "_id",
          foreignField: "brand",
          as: "products",
        },
      },
      {
        $addFields: {
          productCount: { $size: "$products" },
        },
      },
      {
        $project: {
          products: 0,
        },
      },
      {
        $sort: { name: 1 }, // 🔹 Ascending A→Z
      },
    ]);

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
    const userExist = await Brand.findById(id);
    if (!userExist) {
      return res.status(404).json({ msg: "Brand not found" });
    }
    res.status(200).json(userExist);
  } catch (error) {
    console.log(req.params.id);
    res.status(500).json({ error: error });
  }
};
// ✅ Update brand by ID
export const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const newImage = req.file ? await uploadToBlob(req.file, "brands") : null;

    // 🔎 Check duplicate name (excluding same id)
    const duplicate = await Brand.findOne({
      name: name.trim(),
      _id: { $ne: id },
    });
    if (duplicate) {
      return res.json({
        success: false,
        message: "This Brand already exists!",
      });
    }

    // 🔎 Find brand before update
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.json({
        success: false,
        message: "Brand not found!",
      });
    }

    // ✅ Agar new image upload hui hai to purani Blob image delete karo (async)
    if (newImage && brand.image) {
      await deleteFromBlobIfUrl(brand.image);
    }

    // ✅ Update brand
    brand.name = name.trim();
    if (newImage) brand.image = newImage;

    await brand.save();

    res.json({
      success: true,
      message: "Brand updated successfully",
      brand,
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

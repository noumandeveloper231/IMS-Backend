// controllers/categoryController.js
import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import Subcategory from "../models/subcategoryModel.js";
import Product from "../models/productModel.js";
import { uploadToBlob, deleteFromBlobIfUrl } from "../utils/blob.js";
import {
  checkBulkDependencies as checkBulkDependenciesService,
  bulkDeletePreview as bulkDeletePreviewService,
  executeBulkDelete as executeBulkDeleteService,
} from "../services/categoryBulkService.js";
// ✅ Upload category image only (returns URL for use in bulk import etc.)
export const uploadCategoryImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }
    const imageUrl = await uploadToBlob(req.file, "categories");
    res.status(200).json({
      success: true,
      url: imageUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upload image " + error.message,
      error: error.message, 
    });
    console.log(error.message);
  }
};

// ✅ Delete category image from blob by URL (for import: replace image from device)
export const deleteCategoryImageByUrl = async (req, res) => {
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

// ✅ Create category
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const image = req.file
      ? await uploadToBlob(req.file, "categories")
      : null;

    const category = new Category({ name, image });
    await category.save();

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};

// New function for bulk category creation
export const createBulkCategories = async (req, res) => {
  try {
    const categoriesData = req.body; // Yahan Excel se data array ki shakal mein aayega

    const createdCategories = [];
    for (const categoryData of categoriesData) {
      const { name, image } = categoryData; // Yahan name aur image dono mil jayenge

      // Check karein ke category pehle se मौजूद hai ya nahi
      const existingCategory = await Category.findOne({ name: name.trim() });
      if (existingCategory) {
        console.log(`Category already exists, skipping: ${name}`);
        continue; // Existing category ko skip karein
      }

      const newCategory = new Category({
        name: name.trim(),
        image, // Yahan image ka path seedha save ho jayega
      });
      await newCategory.save();
      createdCategories.push(newCategory);
    }

    res.json({
      success: true,
      message: `${createdCategories.length} categories created successfully`,
      categories: createdCategories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create categories in bulk",
      error: error.message,
    });
  }
};
// ✅ Get all categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({
      success: true,
      categories,
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
export const getCategoriesCount = async (req, res) => {
  try {
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
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
      categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
      error: error.message,
    });
  }
};
// ✅ Get single category by ID
export const getCategoryById = async (req, res) => {
  try {
    const id = req.params.id;
    const userExist = await Category.findById(id);
    if (!userExist) {
      return res.status(404).json({ msg: "Category not found" });
    }
    res.status(200).json(userExist);
  } catch (error) {
    console.log(req.params.id);
    res.status(500).json({ error: error });
  }
};
// ✅ Update category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const newImage = req.file
      ? await uploadToBlob(req.file, "categories")
      : null;

    // 🔎 Check if another category with same name exists
    const existingCategory = await Category.findOne({
      name: name.trim(),
      _id: { $ne: id }, // exclude current category from check
    });

    if (existingCategory) {
      return res.json({
        success: false,
        message: "This category already exists!",
      });
    }

    // 🔎 Find category before update
    const category = await Category.findById(id);
    if (!category) {
      return res.json({
        success: false,
        message: "Category not found!",
      });
    }

    // ✅ Agar new image upload hui hai to purani Blob image delete karo
    if (newImage && category.image) {
      await deleteFromBlobIfUrl(category.image);
    }

    // ✅ Update category fields
    category.name = name.trim();
    if (newImage) category.image = newImage;

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};
// ✅ Get category dependencies (subcategories count, products count)
export const getCategoryDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    const [subcategoriesCount, productsCount] = await Promise.all([
      Subcategory.countDocuments({ category: id }),
      Product.countDocuments({ category: id }),
    ]);
    res.status(200).json({
      success: true,
      subcategoriesCount: subcategoriesCount || 0,
      productsCount: productsCount || 0,
      hasDependencies: (subcategoriesCount || 0) > 0 || (productsCount || 0) > 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get category dependencies",
      error: error.message,
    });
  }
};

// ✅ Transfer category dependencies to another category, then delete
export const transferCategoryDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const { transferToCategoryId } = req.body;
    if (!transferToCategoryId) {
      return res.status(400).json({
        success: false,
        message: "transferToCategoryId is required",
      });
    }
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    const targetCategory = await Category.findById(transferToCategoryId);
    if (!targetCategory || targetCategory._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "Target category not found or cannot transfer to same category",
      });
    }
    // Move all subcategories to target category
    await Subcategory.updateMany(
      { category: id },
      { $set: { category: transferToCategoryId } }
    );
    if (!mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(transferToCategoryId)) {
      throw new Error("Invalid category ID");
    }
    const categoryObjId = new mongoose.Types.ObjectId(id);
    const targetObjId = new mongoose.Types.ObjectId(transferToCategoryId);
    await Product.updateMany(
      { category: categoryObjId },
      { $set: { category: targetObjId } }
    );
    // Delete category and its image from blob
    if (category.image) {
      await deleteFromBlobIfUrl(category.image);
    }
    await Category.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Dependencies transferred and category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to transfer dependencies " + error.message,
      error: error.message,
    });
  }
};

// ✅ Delete category (with optional cascade: delete subcategories, unlink products)
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const cascade = req.query.cascade === "true";
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (cascade) {
      // Delete all subcategories under this category
      const subcategories = await Subcategory.find({ category: id });
      for (const sub of subcategories) {
        await Subcategory.findByIdAndDelete(sub._id);
      }
      // Delete all products linked to this category (and their blob images)
      const products = await Product.find({ category: id });
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
      // Check if has dependencies
      const [subCount, productCount] = await Promise.all([
        Subcategory.countDocuments({ category: id }),
        Product.countDocuments({ category: id }),
      ]);
      if (subCount > 0 || productCount > 0) {
        return res.status(409).json({
          success: false,
          message: "Category has linked subcategories or products. Use cascade or transfer.",
          subcategoriesCount: subCount,
          productsCount: productCount,
        });
      }
    }

    // ✅ Agar category ki image hai to Blob se delete karo
    if (category.image) {
      await deleteFromBlobIfUrl(category.image);
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};

// ========== Bulk dependency & delete (enterprise) ==========

/**
 * POST /categories/check-bulk-dependencies
 * Body: { categoryIds: string[] }
 * Returns: { operationId, summary: { total, noDeps, needsResolution }, items: [...] }
 */
export const checkBulkDependencies = async (req, res) => {
  try {
    const { categoryIds } = req.body;
    const result = await checkBulkDependenciesService(categoryIds);
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
 * POST /categories/bulk-delete-preview
 * Body: { categoryIds: string[], resolutionPlan: { id, action, transferTo? }[] }
 * Returns: { summary, categories } (simulation, no commit)
 */
export const bulkDeletePreview = async (req, res) => {
  try {
    const { categoryIds, resolutionPlan } = req.body;
    const result = await bulkDeletePreviewService(categoryIds, resolutionPlan);
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
 * POST /categories/bulk-delete
 * Body: { categoryIds: string[], resolutionPlan: { id, action, transferTo? }[] }
 * Uses transaction; rollback on any failure.
 */
export const bulkDelete = async (req, res) => {
  try {
    const { categoryIds, resolutionPlan } = req.body;
    const result = await executeBulkDeleteService(categoryIds, resolutionPlan);
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

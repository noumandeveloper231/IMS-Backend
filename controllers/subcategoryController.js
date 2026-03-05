// controllers/subcategoryController.js
import mongoose from "mongoose";
import Subcategory from "../models/subcategoryModel.js";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import { deleteFromBlobIfUrl } from "../utils/blob.js";
import {
  checkBulkDependencies as checkBulkDependenciesService,
  bulkDeletePreview as bulkDeletePreviewService,
  executeBulkDelete as executeBulkDeleteService,
} from "../services/subcategoryBulkService.js";

// Create subcategory
export const createSubcategory = async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name?.trim() || !category) {
      return res.status(400).json({
        success: false,
        message: "Name and category are required",
      });
    }
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Category not found",
      });
    }
    const existing = await Subcategory.findOne({
      name: name.trim(),
      category,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "This subcategory already exists in the selected category",
      });
    }
    const subcategory = new Subcategory({ name: name.trim(), category });
    await subcategory.save();
    await subcategory.populate("category", "name");
    res.status(201).json({
      success: true,
      message: "Subcategory created successfully",
      subcategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create subcategory",
      error: error.message,
    });
  }
};

// Bulk create subcategories (same pattern as categories)
export const createBulkSubcategories = async (req, res) => {
  try {
    const subcategoriesData = req.body; // Array of { name, category }

    if (!Array.isArray(subcategoriesData)) {
      return res.status(400).json({
        success: false,
        message: "Request body must be an array of subcategories",
      });
    }

    const createdSubcategories = [];
    for (const item of subcategoriesData) {
      const { name, category } = item;

      if (!name?.trim() || !category) {
        console.log("Skipping row: name and category are required");
        continue;
      }

      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        console.log(`Skipping: category not found for id ${category}`);
        continue;
      }

      const existing = await Subcategory.findOne({
        name: name.trim(),
        category,
      });
      if (existing) {
        console.log(`Subcategory already exists, skipping: ${name} in category ${category}`);
        continue;
      }

      const newSubcategory = new Subcategory({
        name: name.trim(),
        category,
      });
      await newSubcategory.save();
      await newSubcategory.populate("category", "name");
      createdSubcategories.push(newSubcategory);
    }

    res.status(201).json({
      success: true,
      message: `${createdSubcategories.length} subcategories created successfully`,
      subcategories: createdSubcategories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create subcategories in bulk",
      error: error.message,
    });
  }
};

// Get all subcategories (optionally by category)
export const getSubcategories = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const filter = categoryId ? { category: categoryId } : {};
    const subcategories = await Subcategory.find(filter)
      .populate("category", "name")
      .sort({ name: 1 });
    res.status(200).json({
      success: true,
      subcategories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve subcategories",
      error: error.message,
    });
  }
};

// Get subcategories by category ID (for dropdowns)
export const getSubcategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const subcategories = await Subcategory.find({ category: categoryId })
      .sort({ name: 1 })
      .select("name _id category");
    res.status(200).json({
      success: true,
      subcategories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve subcategories",
      error: error.message,
    });
  }
};

// Get single subcategory by ID
export const getSubcategoryById = async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id).populate(
      "category",
      "name"
    );
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }
    res.status(200).json(subcategory);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve subcategory",
      error: error.message,
    });
  }
};

// Update subcategory
export const updateSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;
    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }
    if (name !== undefined) subcategory.name = name.trim();
    if (category !== undefined) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
      subcategory.category = category;
    }
    const existing = await Subcategory.findOne({
      name: subcategory.name,
      category: subcategory.category,
      _id: { $ne: id },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "This subcategory already exists in the selected category",
      });
    }
    await subcategory.save();
    await subcategory.populate("category", "name");
    res.status(200).json({
      success: true,
      message: "Subcategory updated successfully",
      subcategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update subcategory",
      error: error.message,
    });
  }
};

// Delete subcategory
export const deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const cascade = req.query.cascade === "true";

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    if (cascade) {
      const products = await Product.find({ subcategory: id });
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
      const productsCount = await Product.countDocuments({ subcategory: id });
      if (productsCount > 0) {
        return res.status(409).json({
          success: false,
          message:
            "Subcategory has linked products. Use cascade or transfer.",
          productsCount,
        });
      }
    }

    await Subcategory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Subcategory deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete subcategory",
      error: error.message,
    });
  }
};

export const getSubcategoryDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }
    const productsCount = await Product.countDocuments({ subcategory: id });
    res.status(200).json({
      success: true,
      productsCount: productsCount || 0,
      hasDependencies: (productsCount || 0) > 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get subcategory dependencies",
      error: error.message,
    });
  }
};

export const transferSubcategoryDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const { transferToSubcategoryId } = req.body;

    if (!transferToSubcategoryId) {
      return res.status(400).json({
        success: false,
        message: "transferToSubcategoryId is required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(transferToSubcategoryId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid subcategory ID",
      });
    }

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    const targetSubcategory = await Subcategory.findById(transferToSubcategoryId);
    if (!targetSubcategory || targetSubcategory._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message:
          "Target subcategory not found or cannot transfer to same subcategory",
      });
    }

    const sourceId = new mongoose.Types.ObjectId(id);
    const targetId = new mongoose.Types.ObjectId(transferToSubcategoryId);

    await Product.updateMany(
      { subcategory: sourceId },
      { $set: { subcategory: targetId } },
    );

    await Subcategory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Dependencies transferred and subcategory deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to transfer dependencies " + error.message,
      error: error.message,
    });
  }
};

export const checkBulkDependencies = async (req, res) => {
  try {
    const { subcategoryIds } = req.body;
    const result = await checkBulkDependenciesService(subcategoryIds);
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

export const bulkDeletePreview = async (req, res) => {
  try {
    const { subcategoryIds, resolutionPlan } = req.body;
    const result = await bulkDeletePreviewService(subcategoryIds, resolutionPlan);
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

export const bulkDelete = async (req, res) => {
  try {
    const { subcategoryIds, resolutionPlan } = req.body;
    const result = await executeBulkDeleteService(subcategoryIds, resolutionPlan);
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


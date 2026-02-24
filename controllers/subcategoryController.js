// controllers/subcategoryController.js
import Subcategory from "../models/subcategoryModel.js";
import Category from "../models/categoryModel.js";

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
    const subcategory = await Subcategory.findByIdAndDelete(id);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }
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

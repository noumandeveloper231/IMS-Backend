// controllers/categoryController.js
import Category from "../models/categoryModel.js";
import fs from "fs/promises";
import path from "path";

const __dirname = path.resolve(); // root path
// ✅ Create category
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const image = req.file ? `/uploads/categories/${req.file.filename}` : null;

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
          from: "products", // products collection ka naam
          localField: "_id",
          foreignField: "categories", // <-- yaha plural rakho
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
      ? `/uploads/categories/${req.file.filename}`
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

    // ✅ Agar new image upload hui hai to purani image delete karo
    if (newImage && category.image) {
      const oldImagePath = path.join(process.cwd(), category.image);
      try {
        await fs.unlink(oldImagePath); // async delete
      } catch (err) {
        console.warn("⚠️ Old category image delete failed:", err.message);
      }
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
// ✅ Delete category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ✅ Agar category ki image hai to delete karo
    if (category.image) {
      const imagePath = path.join(process.cwd(), category.image); // category.image = "/uploads/categories/xyz.jpg"
      try {
        await fs.unlink(imagePath); // async delete
      } catch (err) {
        console.warn("⚠️ Old category image delete failed:", err.message);
      }
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

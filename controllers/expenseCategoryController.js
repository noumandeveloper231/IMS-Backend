import ExpenseCategory from "../models/expenseCategoryModel.js";

// POST /api/expense-categories/create
export const createExpenseCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const existingCategory = await ExpenseCategory.findOne({ name: name.trim() });
    if (existingCategory) {
      return res.json({
        success: false,
        message: "This Expense Category already exists!",
      });
    }

    const newCategory = new ExpenseCategory({
      name: name.trim(),
      description: description?.trim() || "",
    });
    await newCategory.save();

    res.json({
      success: true,
      message: "Expense Category created successfully",
      category: newCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create Expense Category",
      error: error.message,
    });
  }
};

// GET /api/expense-categories/getall
export const getExpenseCategories = async (req, res) => {
  try {
    const categories = await ExpenseCategory.find().sort("name");
    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve expense categories",
      error: error.message,
    });
  }
};

// GET /api/expense-categories/getone/:id
export const getExpenseCategoryById = async (req, res) => {
  try {
    const id = req.params.id;
    const category = await ExpenseCategory.findById(id);
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: "Expense Category not found" 
      });
    }
    res.status(200).json({
      success: true,
      category
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to retrieve expense category",
      error: error.message 
    });
  }
};

// PUT /api/expense-categories/update/:id
export const updateExpenseCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check duplicate name (excluding same id)
    const duplicate = await ExpenseCategory.findOne({
      name: name.trim(),
      _id: { $ne: id },
    });
    if (duplicate) {
      return res.json({
        success: false,
        message: "This Expense Category already exists!",
      });
    }

    // Find category before update
    const category = await ExpenseCategory.findById(id);
    if (!category) {
      return res.json({
        success: false,
        message: "Expense Category not found!",
      });
    }

    // Update category
    category.name = name.trim();
    category.description = description?.trim() || "";

    await category.save();

    res.json({
      success: true,
      message: "Expense Category updated successfully",
      category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update Expense Category",
      error: error.message,
    });
  }
};

// DELETE /api/expense-categories/delete/:id
export const deleteExpenseCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await ExpenseCategory.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Expense Category not found",
      });
    }

    await ExpenseCategory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Expense Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete expense category",
      error: error.message,
    });
  }
};

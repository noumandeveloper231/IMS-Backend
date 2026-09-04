// controllers/countController.js
import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Brand from "../models/brandModel.js";
import Condition from "../models/conditionModel.js";
import Sale from "../models/saleModel.js";

export const getAllCounts = async (req, res) => {
  try {
    const [products, categories, brands, conditions, sale] = await Promise.all([
      Product.countDocuments(),
      Category.countDocuments(),
      Brand.countDocuments(),
      Condition.countDocuments(),
      Sale.countDocuments(),
    ]);

    res.json({
      products,
      categories,
      brands,
      conditions,
      sale,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStockCounts = async (req, res) => {
  try {
    const inStock = await Product.countDocuments({ quantity: { $gt: 0 } });
    const outOfStock = await Product.countDocuments({ quantity: 0 });

    res.json({
      inStock,
      outOfStock,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

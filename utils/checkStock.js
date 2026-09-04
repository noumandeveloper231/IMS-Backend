import Product from "../models/productModelroduct.js";

exports.checkLowStock = async () => {
  const lowStockItems = await Product.find({ quantity: { $lt: 10 } }); // threshold = 10
  return lowStockItems;
};

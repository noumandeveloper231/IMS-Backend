import Sale from "../models/saleModel.js";
import Product from "../models/productModel.js";
import Expense from "../models/expenseModel.js";
import mongoose from "mongoose";

const getDateRange = (period) => {
  const now = new Date();
  let start;
  switch (period) {
    case "today":
      start = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "week":
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      break;
    case "year":
      start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start = new Date(0);
  }
  return { start, end: new Date() };
};

export const getSalesReport = async (req, res, next) => {
  try {
    const { period = "month", startDate, endDate } = req.query;
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const range = getDateRange(period);
      start = range.start;
      end = range.end;
    }

    const sales = await Sale.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalCOGS: { $sum: "$COGS" },
          totalProfit: { $sum: "$profit" },
          count: { $sum: 1 },
        },
      },
    ]);

    const byChannel = await Sale.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$sellat", total: { $sum: "$grandTotal" }, count: { $sum: 1 } } },
    ]);

    const daily = await Sale.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        summary: sales[0] || {
          totalSales: 0,
          totalCOGS: 0,
          totalProfit: 0,
          count: 0,
        },
        byChannel,
        daily,
        start,
        end,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProfitLossReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    const [sales, expenses] = await Promise.all([
      Sale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$grandTotal" },
            cogs: { $sum: "$COGS" },
            grossProfit: { $sum: "$profit" },
          },
        },
      ]),
      Expense.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const revenue = sales[0]?.revenue || 0;
    const cogs = sales[0]?.cogs || 0;
    const grossProfit = sales[0]?.grossProfit || 0;
    const totalExpenses = expenses[0]?.total || 0;
    const netProfit = grossProfit - totalExpenses;

    res.json({
      success: true,
      data: {
        revenue,
        cogs,
        grossProfit,
        totalExpenses,
        netProfit,
        start,
        end,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getInventoryReport = async (req, res, next) => {
  try {
    const products = await Product.find()
      .populate("category", "name")
      .populate("brand", "name")
      .select("title sku quantity purchasePrice salePrice totalCost")
      .lean();

    const totalValue = products.reduce(
      (acc, p) =>
        acc +
        (p.totalCost && p.quantity > 0
          ? p.totalCost
          : (p.purchasePrice || 0) * p.quantity),
      0
    );

    const lowStock = products.filter((p) => p.quantity <= 5);
    const outOfStock = products.filter((p) => p.quantity === 0);

    res.json({
      success: true,
      data: {
        totalProducts: products.length,
        totalValue,
        totalQuantity: products.reduce((acc, p) => acc + p.quantity, 0),
        lowStock: lowStock.length,
        outOfStock: outOfStock.length,
        lowStockItems: lowStock.slice(0, 20),
        outOfStockItems: outOfStock.slice(0, 20),
      },
    });
  } catch (error) {
    next(error);
  }
};

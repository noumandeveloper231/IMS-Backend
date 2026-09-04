import Sale from "../models/saleModel.js";
import Product from "../models/productModel.js";
import Batch from "../models/batchModel.js";
import Employee from "../models/employeeModel.js";
import generateInvoicePDF from "../utils/generateInvoicePuppeteer.js";
import getNextInvoice from "../utils/getNextInvoice.js";

async function recalcProductTotalCost(productId) {
  const batches = await Batch.find({
    product: productId,
    qtyRemaining: { $gt: 0 },
  });
  return batches.reduce(
    (acc, b) => acc + b.qtyRemaining * b.unitPrice,
    0
  );
}

export const createSale = async (req, res, next) => {
  try {
    const {
      customer,
      items,
      discount = 0,
      paymentMethod,
      employee,
      salesnote,
      shipping = 0,
      status = req.body.status || req.body.paymentStatus || "unpaid",
    } = req.body;
    const sellat = req.body.sellat || req.body.sellAt || "shop";

    const emp = await Employee.findById(employee);
    if (!emp) {
      const error = new Error("Employee (seller) not found");
      error.statusCode = 404;
      throw error;
    }

    let subTotal = 0;
    let saleItems = [];
    let totalCOGS = 0;

    for (let item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }

      let qtyToSell = item.quantity;
      const batches = await Batch.find({
        product: product._id,
        qtyRemaining: { $gt: 0 },
      }).sort({ receivedAt: 1 });

      if (batches.length === 0) {
        if (product.quantity < item.quantity) {
          const error = new Error(`Not enough stock for ${product.title}`);
          error.statusCode = 400;
          throw error;
        }
        const avgCost =
          product.totalCost && product.quantity > 0
            ? product.totalCost / product.quantity
            : item.price;
        const cost = avgCost * item.quantity;
        totalCOGS += cost;
        const total = item.quantity * item.price;
        subTotal += total;
        saleItems.push({
          product: product._id,
          quantity: item.quantity,
          price: item.price,
          purchasePrice: avgCost,
          total,
          returnable: product.returnable,
        });
        product.quantity -= item.quantity;
        product.totalCost = (product.totalCost || 0) - cost;
        await product.save();
        continue;
      }

      for (const batch of batches) {
        if (qtyToSell <= 0) break;
        const sellQty = Math.min(qtyToSell, batch.qtyRemaining);
        const cost = sellQty * batch.unitPrice;
        totalCOGS += cost;
        batch.qtyRemaining -= sellQty;
        await batch.save();
        const total = sellQty * item.price;
        subTotal += total;
        saleItems.push({
          product: product._id,
          batch: batch._id,
          quantity: sellQty,
          price: item.price,
          purchasePrice: batch.unitPrice,
          total,
          returnable: product.returnable,
        });
        qtyToSell -= sellQty;
      }

      if (qtyToSell > 0) {
        const error = new Error(`Not enough stock for ${product.title}`);
        error.statusCode = 400;
        throw error;
      }

      product.quantity -= item.quantity;
      product.totalCost = await recalcProductTotalCost(product._id);
      await product.save();
    }

    const vat = subTotal * 0.05;
    const grandTotal = subTotal + vat + Number(shipping) - discount;
    const profit = grandTotal - totalCOGS;
    const invoiceNo = await getNextInvoice("AL");

    const sale = await Sale.create({
      invoiceNo,
      customer,
      items: saleItems,
      subTotal,
      vat,
      shipping,
      discount,
      grandTotal,
      COGS: totalCOGS,
      profit,
      paymentMethod: paymentMethod || "cash",
      sellat: sellat || "shop",
      employee: emp._id,
      salesnote: salesnote || "",
      status: status || "unpaid",
    });

    res.status(201).json(sale);
  } catch (error) {
    next(error);
  }
};

export const getSales = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const filter = {};
    if (search) {
      filter.$or = [
        { invoiceNo: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
        { "customer.phone": { $regex: search, $options: "i" } },
      ];
    }

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .populate("items.product", "title salePrice")
        .populate("employee", "name role")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Sale.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSaleById = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("items.product", "title salePrice")
      .populate("employee", "name role");
    if (!sale) {
      const error = new Error("Sale not found");
      error.statusCode = 404;
      throw error;
    }
    res.json(sale);
  } catch (error) {
    next(error);
  }
};

export const updateSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      const error = new Error("Sale not found");
      error.statusCode = 404;
      throw error;
    }
    sale.discount = req.body.discount ?? sale.discount;
    sale.paymentMethod = req.body.paymentMethod ?? sale.paymentMethod;
    sale.sellat = req.body.sellat ?? sale.sellat;
    sale.salesnote = req.body.salesnote ?? sale.salesnote;
    sale.shipping = req.body.shipping ?? sale.shipping;
    sale.vat = req.body.vat ?? sale.vat;
    sale.status = req.body.status ?? sale.status;
    sale.grandTotal =
      sale.subTotal +
      Number(sale.vat) +
      Number(sale.shipping) -
      (sale.discount || 0);
    await sale.save();
    res.json(sale);
  } catch (error) {
    next(error);
  }
};

export const deleteSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      const error = new Error("Sale not found");
      error.statusCode = 404;
      throw error;
    }
    for (let item of sale.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }
    await sale.deleteOne();
    res.json({ message: "Sale deleted and stock restored" });
  } catch (error) {
    next(error);
  }
};

export const processRefund = async (req, res, next) => {
  try {
    const { saleId } = req.params;
    const { itemIndex, refundQty, refundAmount } = req.body;

    const sale = await Sale.findById(saleId).populate("items.product");
    if (!sale) {
      const error = new Error("Sale not found");
      error.statusCode = 404;
      throw error;
    }

    const item = sale.items[itemIndex];
    if (!item) {
      const error = new Error("Item not found");
      error.statusCode = 404;
      throw error;
    }
    if (!item.returnable) {
      const error = new Error("This product is non-returnable");
      error.statusCode = 400;
      throw error;
    }
    if (refundQty > item.quantity) {
      const error = new Error("Refund quantity exceeds sold quantity");
      error.statusCode = 400;
      throw error;
    }

    const product = await Product.findById(item.product._id);
    if (product) {
      product.quantity += refundQty;
      await product.save();
    }

    item.quantity -= refundQty;
    item.refundAmount = (item.refundAmount || 0) + (refundAmount || item.price * refundQty);
    item.refunded = item.quantity <= 0;
    await sale.save();

    const updatedSale = await Sale.findById(saleId)
      .populate("items.product", "title salePrice")
      .populate("employee", "name");
    res.json({
      success: true,
      message: "Refund processed successfully",
      sale: updatedSale,
    });
  } catch (error) {
    next(error);
  }
};

export const getInvoice = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("items.product", "title salePrice")
      .exec();
    if (!sale) {
      const error = new Error("Sale not found");
      error.statusCode = 404;
      throw error;
    }
    generateInvoicePDF(res, sale);
  } catch (error) {
    next(error);
  }
};

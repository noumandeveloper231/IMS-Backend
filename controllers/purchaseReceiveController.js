// controllers/purchaseReceiveController.js
import PurchaseReceive from "../models/purchaseReceiveModel.js";
import PurchaseOrder from "../models/purchaseOrderModel.js";
// import Batch from "../models/batchModel.js";
import Product from "../models/productModel.js";
import mongoose from "mongoose";
import Condition from "../models/conditionModel.js";
import Brand from "../models/brandModel.js";
import QRCode from "qrcode";
import { uploadToBlob } from "../utils/blob.js";
// export const createPurchaseReceive = async (req, res) => {
//   try {
//     const { receiveNo, purchaseOrder, vendor, items, notes } = req.body;

//     // Total calculate
//     const totalAmount = items.reduce((acc, item) => acc + item.total, 0);

//     const receive = new PurchaseReceive({
//       receiveNo,
//       purchaseOrder,
//       vendor,
//       items,
//       notes,
//       totalAmount,
//     });

//     await receive.save();

//     // Purchase Order ka status update karo
//     const order = await PurchaseOrder.findById(purchaseOrder);
//     if (order) {
//       let receivedAll = true;
//       items.forEach((item) => {
//         const orderItem = order.items.find(
//           (oi) => oi.product.toString() === item.product.toString()
//         );
//         if (orderItem && item.receivedQty < orderItem.quantity) {
//           receivedAll = false;
//         }
//       });
//       order.status = receivedAll ? "received" : "approved";
//       await order.save();
//     }

//     res.status(201).json(receive);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// };

// ✅ Create Purchase Receive + Auto Batch Creation
// export const createPurchaseReceive = async (req, res) => {
//   try {
//     const {
//       receiveNo,
//       purchaseOrder,
//       vendor,
//       items,
//       receiveDate,
//       status,
//       notes,
//       totalAmount,
//     } = req.body;

//     // 1️⃣ Save Purchase Receive
//     const purchaseReceive = new PurchaseReceive({
//       receiveNo,
//       purchaseOrder,
//       vendor,
//       items,
//       receiveDate,
//       status,
//       notes,
//       totalAmount,
//     });

//     await purchaseReceive.save();

//     // 2️⃣ Loop through items & create Batch entries
//     for (const item of items) {
//       const { product, receivedQty, purchasePrice } = item;

//       // 🔹 Create Batch
//       const batch = new Batch({
//         product,
//         purchaseReceive: purchaseReceive._id,
//         purchaseOrder,
//         vendor,
//         qtyReceived: receivedQty,
//         qtyRemaining: receivedQty, // FIFO ke liye
//         unitPrice: purchasePrice,
//         receivedAt: receiveDate || new Date(),
//       });

//       await batch.save();

//       // 🔹 Update Product stock & avg cost
//       const prod = await Product.findById(product);

//       if (prod) {
//         const oldStock = prod.totalStock || 0;
//         const oldAvgCost = prod.avgCost || 0;

//         const newStock = oldStock + receivedQty;

//         // Weighted Average Formula
//         const newAvgCost =
//           (oldStock * oldAvgCost + receivedQty * purchasePrice) / newStock;

//         prod.totalStock = newStock;
//         prod.avgCost = newAvgCost;

//         await prod.save();
//       }
//     }

//     res.status(201).json({
//       success: true,
//       message: "Purchase Receive created & Batches updated successfully",
//       purchaseReceive,
//     });
//   } catch (error) {
//     console.error("❌ Error in createPurchaseReceive:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server Error",
//       error: error.message,
//     });
//   }
// };
// Helper function: auto receive number generate
const generateReceiveNo = async () => {
  const lastReceive = await PurchaseReceive.findOne().sort({ createdAt: -1 });
  if (!lastReceive) return "PR-1001";

  const lastNo = parseInt(lastReceive.receiveNo.split("-")[1]);
  return `PR-${lastNo + 1}`;
};

export const createPurchaseReceive = async (req, res) => {
  try {
    const { purchaseOrder, vendor, items, receiveDate, notes } = req.body;

    // 🧩 Validation
    if (!purchaseOrder || !vendor) {
      return res.status(400).json({
        success: false,
        message: "Purchase order and vendor are required.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items provided.",
      });
    }

    let totalAmount = 0;
    let processedItems = [];

    // 🧮 Process each item
    for (const item of items) {
      const {
        itemId,
        title,
        asin,
        brand,
        condition,
        purchasePrice,
        salePrice,
        receivedQty,
        orderedQty,
      } = item;

      // Skip incomplete item
      if (!asin || !title || !purchasePrice || !receivedQty) continue;

      const total = purchasePrice * receivedQty;
      totalAmount += total;

      // 🎯 Resolve condition name
      // let conditionName = "Used";
      // if (typeof condition === "string" && condition.length === 24) {
      //   const conditionDoc = await Condition.findById(condition).select("name");
      //   if (conditionDoc) conditionName = conditionDoc.name;
      // } else if (typeof condition === "string") {
      //   conditionName = condition;
      // }
      // 🔍 Resolve conditionId
      // 🧩 Resolve condition & brand IDs
      let conditionId = null;
      if (
        condition &&
        typeof condition === "string" &&
        condition.length === 24
      ) {
        conditionId = condition;
      } else {
        const cDoc = await Condition.findOne({ name: condition });
        if (cDoc) conditionId = cDoc._id;
      }

      let brandId = null;
      if (brand && typeof brand === "string" && brand.length === 24) {
        brandId = brand;
      } else {
        const bDoc = await Brand.findOne({ name: brand });
        if (bDoc) brandId = bDoc._id;
      }

      // 🏷️ Get condition name for SKU
      let conditionNameForSku = "Unknown";
      if (conditionId) {
        const cDoc = await Condition.findById(conditionId).select("name");
        if (cDoc) conditionNameForSku = cDoc.name;
      }

      // 🏷️ Generate SKU
      const sku = `AL-${asin}-${conditionNameForSku}`;

      // 🧾 QR code for SKU
      const qrCode = await QRCode.toDataURL(sku);

      // 🖼️ Product image (optional)
      const image = req.file
        ? await uploadToBlob(req.file, "products")
        : null;

      // 🔍 Check product existence
      let product = await Product.findOne({ sku });

      if (product) {
        // Update existing product
        product.quantity += Number(receivedQty);
        product.purchasePrice = purchasePrice;
        if (salePrice && salePrice > 0) product.salePrice = salePrice;
        await product.save();
      } else {
        // Create new product
        product = new Product({
          title,
          asin,
          sku,
          brand: brandId || undefined,
          condition: conditionId || undefined,
          purchasePrice,
          salePrice,
          quantity: receivedQty,
          vendor,
          qrCode,
          image,
        });
        await product.save();
      }

      // Push item into processed array
      processedItems.push({
        itemId, // ✅ Include itemId for matching with PO items
        product: product._id,
        title,
        asin,
        brands: [brandId], // ✅ array of ObjectId
        conditions: [conditionId], // ✅ array of ObjectId
        purchasePrice,
        salePrice,
        orderedQty: orderedQty || 0,
        receivedQty,
        total,
        status: "approved",
      });
    }

    // 🧾 Generate next PR number
    const lastReceive = await PurchaseReceive.findOne().sort({ createdAt: -1 });
    const nextNumber = lastReceive
      ? parseInt(lastReceive.receiveNo.replace("PR-", "")) + 1
      : 1;
    const receiveNo = `PR-${nextNumber}`;

    // 🆕 Create new Purchase Receive entry
    const newReceive = new PurchaseReceive({
      receiveNo,
      purchaseOrder,
      vendor,
      receiveDate,
      notes,
      items: processedItems,
      totalAmount,
      status: "partially",
    });

    await newReceive.save();

    // 🔄 Update related Purchase Order
    const po = await PurchaseOrder.findById(purchaseOrder);
    if (po) {
      let allCompleted = true;

      po.items = po.items.map((poItem) => {
        // ✅ Match by item._id (unique) instead of just ASIN
        const receivedItem = processedItems.find(
          (r) => r.itemId && String(r.itemId) === String(poItem._id)
        );

        if (receivedItem) {
          poItem.receivedQty =
            Number(poItem.receivedQty || 0) + Number(receivedItem.receivedQty);

          // Prevent over-receive
          if (poItem.receivedQty > poItem.orderedQty) {
            poItem.receivedQty = poItem.orderedQty;
          }

          // Check completion
          if (poItem.receivedQty < poItem.orderedQty) {
            allCompleted = false;
          }
        } else if (poItem.receivedQty < poItem.orderedQty) {
          allCompleted = false;
        }

        return poItem;
      });

      po.status = allCompleted ? "completed" : "partially";
      await po.save();

      // Reflect status on PR
      newReceive.status = po.status;
      await newReceive.save();
    }

    // ✅ Final Response
    res.status(201).json({
      success: true,
      message: "✅ Purchase Receive created successfully!",
      data: newReceive,
    });
  } catch (error) {
    console.error("❌ Error in createPurchaseReceive:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// export const createPurchaseReceive = async (req, res) => {
//   try {
//     const { purchaseOrder, vendor, items, receiveDate, notes } = req.body;

//     // ⚠️ Validate items
//     if (!items || items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No items provided",
//       });
//     }

//     let totalAmount = 0;
//     let processedItems = [];

//     // ✅ Loop through each item in payload
//     for (const item of items) {
//       const { title, asin, brand, condition, purchasePrice, salePrice, receivedQty, orderedQty } = item;

//       // Required field validation
//       if (!asin || !title || !purchasePrice || !receivedQty || !salePrice ) continue;

//       const total = purchasePrice * receivedQty;
//       totalAmount += total;

//       // ✅ Fetch condition name (if condition is ObjectId)
//       let conditionDoc = null;
//       if (typeof condition === "string" && condition.length === 24) {
//         conditionDoc = await mongoose.model("Condition").findById(condition).select("name");
//       }
//       const conditionName = conditionDoc ? conditionDoc.name : condition || "Used";

//       // ✅ SKU generate dynamically
//       const sku = `Al-${asin}-${conditionName}`;

//       // ✅ QR Code generate
//       const qrCode = await QRCode.toDataURL(sku);
//       const image = req.file ? `/uploads/products/${req.file.filename}` : null;

//       // ✅ Check if product already exists (by SKU)
//       let product = await Product.findOne({ sku });

//       if (product) {
//         // Update existing product quantity & purchase price
//         product.quantity += receivedQty;
//         product.purchasePrice = purchasePrice;
//          // ✅ Update sale price if provided
//   if (salePrice && salePrice > 0) {
//     product.salePrice = salePrice;
//   }
//         await product.save();
//       } else {
//         // Create new product
//         product = new Product({
//           title,
//           asin,
//           sku,
//           brand,
//           condition,
//           purchasePrice,
//           salePrice, // ✅ Include here
//           quantity: receivedQty,
//           vendor,
//           qrCode,
//           image,
//         });
//         await product.save();
//       }

//       // ✅ Push item to processedItems
//       processedItems.push({
//         product: product._id,
//         title,
//         asin,
//         brand,
//         condition,
//         purchasePrice,
//         salePrice, // ✅ Optional
//         orderedQty: orderedQty || 0,
//         receivedQty,
//         total,
//         status: "approved",
//       });
//     }

//     // ✅ Generate next PR number
//     const lastReceive = await PurchaseReceive.findOne().sort({ createdAt: -1 });
//     const nextNumber = lastReceive
//       ? parseInt(lastReceive.receiveNo.replace("PR-", "")) + 1
//       : 1;
//     const receiveNo = `PR-${nextNumber}`;

//     // ✅ Create new Purchase Receive
//     const newReceive = new PurchaseReceive({
//       receiveNo,
//       purchaseOrder,
//       vendor,
//       receiveDate,
//       notes,
//       items: processedItems,
//       totalAmount,
//       status: "partially", // default (will change after check)
//     });

//     await newReceive.save();

//     // ✅ Update Purchase Order quantities & status
//     const po = await PurchaseOrder.findById(purchaseOrder);
//     if (po) {
//       let allCompleted = true;

//       po.items = po.items.map((poItem) => {
//         const receivedItem = processedItems.find(
//           (r) => String(r.asin) === String(poItem.asin)
//         );

//         if (receivedItem) {
//           // Add new receivedQty to existing one
//           poItem.receivedQty =
//             Number(poItem.receivedQty || 0) + Number(receivedItem.receivedQty);

//           // Prevent exceeding ordered quantity
//           if (poItem.receivedQty > poItem.orderedQty) {
//             poItem.receivedQty = poItem.orderedQty;
//           }

//           // Still pending?
//           if (poItem.receivedQty < poItem.orderedQty) {
//             allCompleted = false;
//           }
//         } else {
//           // Item not received in this PR
//           if (poItem.receivedQty < poItem.orderedQty) {
//             allCompleted = false;
//           }
//         }

//         return poItem;
//       });

//       po.status = allCompleted ? "completed" : "partially";
//       await po.save();

//       // Update PR status based on PO status
//       newReceive.status = po.status;
//       await newReceive.save();
//     }

//     res.status(201).json({
//       success: true,
//       message: "✅ Purchase Receive created successfully (Partial handling fixed)",
//       data: newReceive,
//     });
//   } catch (error) {
//     console.error("❌ Error in createPurchaseReceive:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server Error",
//       error: error.message,
//     });
//   }
// };

export const getPurchaseReceives = async (req, res) => {
  try {
    const receives = await PurchaseReceive.find()
      .populate("purchaseOrder", "orderNo")
      .populate("vendor", "name companyName")
      .populate("items.product", "title asin sku salePrice");
    res.json(receives);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// routes/purchaseOrderRoutes.js
export const getPurchaseOrdersByVendor = async (req, res) => {
  try {
    const receives = await PurchaseReceive.find({ vendor: req.params.vendorId })
      .populate("items.product", "title sku")
      .populate("purchaseOrder", "orderNo");
    res.json(receives);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getPurchaseReceiveById = async (req, res) => {
  try {
    const receive = await PurchaseReceive.findById(req.params.id)
      .populate("purchaseOrder", "orderNo")
      .populate("vendor", "name companyName");
    // .populate("items.product", "title sku");
    if (!receive) return res.status(404).json({ message: "Receive not found" });
    res.json(receive);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updatePurchaseReceive = async (req, res) => {
  try {
    const receive = await PurchaseReceive.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );
    if (!receive) return res.status(404).json({ message: "Receive not found" });
    res.json(receive);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const deletePurchaseReceive = async (req, res) => {
  try {
    const receive = await PurchaseReceive.findByIdAndDelete(req.params.id);
    if (!receive) return res.status(404).json({ message: "Receive not found" });
    res.json({ message: "Purchase receive deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

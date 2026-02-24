// controllers/purchaseOrderController.js
import PurchaseOrder from "../models/purchaseOrderModel.js";

// Auto-generate OrderNo helper
const getNextOrderNo = async () => {
  const lastOrder = await PurchaseOrder.findOne().sort({ createdAt: -1 });
  if (!lastOrder) return "PO-1001"; // first order
  const lastNo = parseInt(lastOrder.orderNo.split("-")[1], 10);
  return `PO-${lastNo + 1}`;
};

export const createPurchaseOrder = async (req, res) => {
  try {
    const { vendor, items, expectedDelivery, notes } = req.body;
    

    if (!vendor) {
      return res.status(400).json({ message: "Vendor is required" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    // ✅ orderNo auto-generate
    const orderNo = await getNextOrderNo();

    // ✅ total calculate
    const totalAmount = items.reduce((acc, item) => acc + item.total, 0);

    const purchaseOrder = new PurchaseOrder({
      orderNo,
      vendor,
      items: items.map((item) => ({
        title: item.title, // frontend se productId ko product me bhejna hoga
        asin: item.asin,
        receivedQty: item.receivedQty,
        orderedQty: item.orderedQty,
        purchasePrice: item.purchasePrice,
        total: item.total,
      })),
      expectedDelivery,
      notes,
      totalAmount,
    });
    

    await purchaseOrder.save();
    res.status(201).json(purchaseOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
// ✅ Create
// export const createPurchaseOrder = async (req, res) => {
//   try {
//     const { orderNo, vendor, items, expectedDelivery, notes } = req.body;

//     // Total calculate
//     const totalAmount = items.reduce((acc, item) => acc + item.total, 0);

//     const purchaseOrder = new PurchaseOrder({
//       orderNo,
//       vendor,
//       items,
//       expectedDelivery,
//       notes,
//       totalAmount,
//     });

//     await purchaseOrder.save();
//     res.status(201).json(purchaseOrder);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// };

// ✅ Get All

export const getPurchaseOrders = async (req, res) => {
  try {
    const orders = await PurchaseOrder.find()
      .populate("vendor", "name companyName");
      // .populate("items.product", "title sku");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get by ID
export const getPurchaseOrderById = async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate("vendor", "name companyName")
      .populate("items.product", "title sku");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Update
export const updatePurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ✅ Delete
export const deletePurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Purchase order deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

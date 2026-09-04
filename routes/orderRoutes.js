import express from "express";
import Order from "../models/saleModel.js"; // adjust path as per your project
import { generateInvoice } from "../utils/generateInvoice.js";

const router = express.Router();

// Download Invoice Route
router.get("/:id/invoice", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    generateInvoice(order, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

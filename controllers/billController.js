import Bill from "../models/billModel.js";

// 📌 Create Bill
export const createBill = async (req, res) => {
  try {
    const bill = new Bill(req.body);
    await bill.save();
    res.status(201).json(bill);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 📌 Get All Bills
export const getBills = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate("vendor", "name contact")
      .populate("purchaseOrder", "orderNumber");
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 📌 Get Single Bill
export const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate("vendor", "name contact")
      .populate("purchaseOrder", "orderNumber");
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 📌 Update Bill
export const updateBill = async (req, res) => {
  try {
    const bill = await Bill.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(bill);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 📌 Delete Bill
export const deleteBill = async (req, res) => {
  try {
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ message: "Bill deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

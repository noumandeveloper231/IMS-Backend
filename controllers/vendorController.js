// controllers/vendorController.js
import Vendor from "../models/vendorModel.js";

// ✅ Create Vendor
export const createVendor = async (req, res) => {
  try {
    const vendor = new Vendor(req.body);
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(400).json({ message: "A vendor with this email already exists." });
    }
    res.status(400).json({ message: err.message });
  }
};

// ✅ Get All Vendors
export const getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get Single Vendor
export const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Update Vendor
export const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json(vendor);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(400).json({ message: "A vendor with this email already exists." });
    }
    res.status(400).json({ message: err.message });
  }
};

// ✅ Delete Vendor
export const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json({ message: "Vendor deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Bulk Create Vendors (import)
export const createBulkVendors = async (req, res) => {
  try {
    const vendorsData = Array.isArray(req.body) ? req.body : req.body?.vendors ?? [];
    let createdCount = 0;
    let errorCount = 0;
    const created = [];
    const errors = [];

    for (let i = 0; i < vendorsData.length; i++) {
      const data = vendorsData[i];
      try {
        const payload = {
          name: data.name ?? data.Name ?? "",
          companyName: data.companyName ?? data["Company Name"] ?? "",
          email: data.email ?? data.Email ?? "",
          phone: data.phone ?? data.Phone ?? "",
          address: data.address ?? data.Address ?? "",
          city: data.city ?? data.City ?? "",
          country: data.country ?? data.Country ?? "",
          openingBalance: Number(data.openingBalance ?? data["Opening Balance"] ?? 0) || 0,
          notes: data.notes ?? data.Notes ?? "",
          status: (() => {
            const v = (data.status ?? data.Status ?? "active").toString().trim().toLowerCase();
            return v === "inactive" ? "inactive" : "active";
          })(),
        };
        const vendor = new Vendor(payload);
        await vendor.save();
        created.push(vendor);
        createdCount++;
      } catch (err) {
        errorCount++;
        const message =
          err.code === 11000 && err.keyPattern?.email
            ? "Duplicate email"
            : err.message || "Validation failed";
        errors.push({ index: i + 1, message });
      }
    }

    res.status(200).json({
      success: true,
      createdCount,
      errorCount,
      errors,
      message: `${createdCount} vendors created${errorCount > 0 ? `, ${errorCount} errors` : ""}`,
      vendors: created,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to create vendors in bulk",
      error: err.message,
    });
  }
};

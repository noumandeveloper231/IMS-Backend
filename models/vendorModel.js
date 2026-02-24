// models/Vendor.js
import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // supplier ka naam zaroori h
    },
    companyName: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // sab k email nh hote
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
    },
    city: {
      type: String,
    },
    country: {
      type: String,
    },
    openingBalance: {
      type: Number,
      default: 0, // agar vendor ko pehle se paisa dena h
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Vendor", vendorSchema);

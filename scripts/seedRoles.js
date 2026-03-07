import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../models/roleModel.js";
import { PERMISSIONS, ALL_PERMISSIONS } from "../constants/permissions.js";

dotenv.config();

const ROLES = [
  {
    name: "admin",
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "manager",
    permissions: [
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_READ,
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.CATEGORY_MANAGE,
      PERMISSIONS.SUBCATEGORY_MANAGE,
      PERMISSIONS.BRAND_MANAGE,
      PERMISSIONS.CONDITION_MANAGE,
      PERMISSIONS.ORDER_CREATE,
      PERMISSIONS.ORDER_READ,
      PERMISSIONS.ORDER_UPDATE,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.MEDIA_UPLOAD,
      PERMISSIONS.MEDIA_READ,
      PERMISSIONS.MEDIA_DELETE,
      PERMISSIONS.VENDOR_MANAGE,
      PERMISSIONS.EXPENSE_MANAGE,
      PERMISSIONS.PURCHASE_MANAGE,
      PERMISSIONS.EMPLOYEE_MANAGE,
      PERMISSIONS.CUSTOMER_MANAGE,
      PERMISSIONS.DEVICE_MANAGE,
    ],
  },
  {
    name: "salesman",
    permissions: [
      PERMISSIONS.ORDER_CREATE,
      PERMISSIONS.ORDER_READ,
      PERMISSIONS.PRODUCT_READ,
    ],
  },
  {
    name: "inventory_manager",
    permissions: [
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_READ,
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.CATEGORY_MANAGE,
      PERMISSIONS.SUBCATEGORY_MANAGE,
      PERMISSIONS.BRAND_MANAGE,
      PERMISSIONS.CONDITION_MANAGE,
    ],
  },
  {
    name: "viewer",
    permissions: [PERMISSIONS.REPORT_READ, PERMISSIONS.ORDER_READ],
  },
];

async function seedRoles() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    for (const role of ROLES) {
      await Role.findOneAndUpdate(
        { name: role.name },
        { $set: { permissions: role.permissions } },
        { upsert: true, new: true }
      );
      console.log(`✅ Role "${role.name}" seeded (${role.permissions.length} permissions)`);
    }
    console.log("Roles seed complete.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedRoles();

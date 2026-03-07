/**
 * Module-level permissions for the POS/IMS.
 * Format: <module>.<action>
 * Actions: read, create, update, delete, manage (manage = full access for that module).
 */

// Named constants for use in seed and routes (avoids typos)
export const PERMISSIONS = {
  // User & role
  USER_READ: "user.read",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_MANAGE: "user.manage",
  // Product
  PRODUCT_READ: "product.read",
  PRODUCT_CREATE: "product.create",
  PRODUCT_UPDATE: "product.update",
  PRODUCT_DELETE: "product.delete",
  PRODUCT_MANAGE: "product.manage",
  // Category, subcategory, brand, condition
  CATEGORY_MANAGE: "category.manage",
  SUBCATEGORY_MANAGE: "subcategory.manage",
  BRAND_MANAGE: "brand.manage",
  CONDITION_MANAGE: "condition.manage",
  // Orders / sales
  ORDER_READ: "order.read",
  ORDER_CREATE: "order.create",
  ORDER_UPDATE: "order.update",
  ORDER_MANAGE: "order.manage",
  // Purchase, vendor, bills
  PURCHASE_MANAGE: "purchase.manage",
  VENDOR_MANAGE: "vendor.manage",
  // Customer, employee, expense
  CUSTOMER_MANAGE: "customer.manage",
  EMPLOYEE_MANAGE: "employee.manage",
  EXPENSE_MANAGE: "expense.manage",
  // Report, media, device, settings
  REPORT_READ: "report.read",
  MEDIA_READ: "media.read",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_DELETE: "media.delete",
  DEVICE_MANAGE: "device.manage",
  SETTINGS_MANAGE: "settings.manage",
};

/** All permissions (for admin role seed). */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/** Modules that have separate read/create/update/delete or manage. */
export const MODULES = [
  "user",
  "role",
  "category",
  "subcategory",
  "brand",
  "condition",
  "product",
  "vendor",
  "purchase",
  "order",
  "customer",
  "employee",
  "expense",
  "report",
  "media",
  "device",
  "settings",
];

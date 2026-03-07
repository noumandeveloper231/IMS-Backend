/**
 * Central list of permissions (resource.action).
 * Use these when seeding roles and in allow() middleware.
 */
export const PERMISSIONS = {
  // Products
  PRODUCT_CREATE: "product.create",
  PRODUCT_READ: "product.read",
  PRODUCT_UPDATE: "product.update",
  PRODUCT_DELETE: "product.delete",
  // Categories
  CATEGORY_MANAGE: "category.manage",
  SUBCATEGORY_MANAGE: "subcategory.manage",
  BRAND_MANAGE: "brand.manage",
  CONDITION_MANAGE: "condition.manage",
  // Orders / Sales
  ORDER_CREATE: "order.create",
  ORDER_READ: "order.read",
  ORDER_UPDATE: "order.update",
  // Users & system
  USER_MANAGE: "user.manage",
  REPORT_READ: "report.read",
  SETTINGS_MANAGE: "settings.manage",
  // Media
  MEDIA_UPLOAD: "media.upload",
  MEDIA_READ: "media.read",
  MEDIA_DELETE: "media.delete",
  // Other resources
  VENDOR_MANAGE: "vendor.manage",
  EXPENSE_MANAGE: "expense.manage",
  PURCHASE_MANAGE: "purchase.manage",
  EMPLOYEE_MANAGE: "employee.manage",
  CUSTOMER_MANAGE: "customer.manage",
  DEVICE_MANAGE: "device.manage",
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

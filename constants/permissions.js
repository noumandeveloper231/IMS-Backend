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

/** Write-type actions: having any of these implies the module's read permission (if it exists). */
const WRITE_ACTIONS = ["create", "update", "delete", "manage", "upload"];

/** Set of permission values for quick lookup. */
const PERMISSION_SET = new Set(Object.values(PERMISSIONS));

/**
 * Returns permissions with implied reads added: for any write permission (create, update, delete, manage, upload),
 * the corresponding module's "read" permission is added if it exists. So e.g. product.manage => also product.read.
 */
export function getEffectivePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  const set = new Set(permissions);
  for (const p of permissions) {
    if (typeof p !== "string") continue;
    const [module, action] = p.split(".");
    if (!module || !action) continue;
    if (!WRITE_ACTIONS.includes(action)) continue;
    const readPerm = `${module}.read`;
    if (PERMISSION_SET.has(readPerm)) set.add(readPerm);
  }
  return Array.from(set);
}

/** Human-readable labels for each permission (for role editor UI). */
const ACTION_LABELS = {
  read: "Read",
  create: "Create",
  update: "Update",
  delete: "Delete",
  manage: "Full access (read & write)",
  upload: "Upload",
};

/** List of permissions with value, label, module, action, and isWrite for API/UI. */
export const PERMISSIONS_LIST = Object.entries(PERMISSIONS).map(([key, value]) => {
  const [module, action] = value.split(".");
  const moduleLabel = module.charAt(0).toUpperCase() + module.slice(1).replace(/_/g, " ");
  const actionLabel = ACTION_LABELS[action] || action;
  return {
    value,
    label: `${moduleLabel} - ${actionLabel}`,
    module: module,
    action: action,
    isWrite: WRITE_ACTIONS.includes(action),
    /** Permission value for "read" in this module, if it exists (e.g. "product.read"). */
    readPermission: PERMISSION_SET.has(`${module}.read`) ? `${module}.read` : null,
  };
});

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

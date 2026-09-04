import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Subcategory from "../models/subcategoryModel.js";
import Brand from "../models/brandModel.js";
import Condition from "../models/conditionModel.js";
import User from "../models/userModel.js";
import Customer from "../models/customerModel.js";
import Vendor from "../models/vendorModel.js";
import Employee from "../models/employeeModel.js";
import Sale from "../models/saleModel.js";
import PurchaseOrder from "../models/purchaseOrderModel.js";
import PurchaseReceive from "../models/purchaseReceiveModel.js";
import Bill from "../models/billModel.js";
import Refund from "../models/refundModel.js";
import Expense from "../models/expenseModel.js";

// @desc    Global search across all modules
// @route   GET /api/search
// @access  Private
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    const query = q ? q.trim() : "";

    if (!query) {
      return res.json([]);
    }

    const results = [];
    const searchRegex = new RegExp(query, "i");
    const slashCommand = query.startsWith("/") ? query.slice(1).trim().toLowerCase() : "";
    const isSlashCommand = Boolean(slashCommand);
    const commandAliases = {
      products: "products",
      product: "products",
      categories: "categories",
      category: "categories",
      subcategories: "subcategories",
      subcategory: "subcategories",
      brands: "brands",
      brand: "brands",
      conditions: "conditions",
      condition: "conditions",
      users: "users",
      user: "users",
      customers: "customers",
      customer: "customers",
      vendors: "vendors",
      vendor: "vendors",
      employees: "employees",
      employee: "employees",
      sales: "sales",
      sale: "sales",
      orders: "sales",
      "purchase-orders": "purchase-orders",
      po: "purchase-orders",
      "purchase-receives": "purchase-receives",
      pr: "purchase-receives",
      bills: "bills",
      bill: "bills",
      refunds: "refunds",
      refund: "refunds",
      expenses: "expenses",
      expense: "expenses",
      settings: "settings",
      reports: "reports",
    };
    const commandCategory = commandAliases[slashCommand] || null;
    const shouldRunCategory = (category) =>
      !isSlashCommand || (commandCategory && commandCategory === category);
    const commandLimit = 1000;

    // Search Products
    const products = shouldRunCategory("products")
      ? await Product.find(
          isSlashCommand
            ? {}
            : {
                $or: [
                  { name: searchRegex },
                  { sku: searchRegex },
                  { barcode: searchRegex },
                ],
              },
        )
          .select("name sku _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    products.forEach((p) => {
      results.push({
        id: p._id,
        category: "products",
        title: p.name,
        description: p.sku ? `SKU: ${p.sku}` : undefined,
        path: `/products/${p._id}`,
      });
    });

    // Search Categories
    const categories = shouldRunCategory("categories")
      ? await Category.find(isSlashCommand ? {} : { $or: [{ name: searchRegex }] })
          .select("name _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    categories.forEach((c) => {
      results.push({
        id: c._id,
        category: "categories",
        title: c.name,
        description: undefined,
        path: `/categories`,
      });
    });

    // Search Subcategories
    const subcategories = shouldRunCategory("subcategories")
      ? await Subcategory.find(isSlashCommand ? {} : { $or: [{ name: searchRegex }] })
          .select("name _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    subcategories.forEach((s) => {
      results.push({
        id: s._id,
        category: "subcategories",
        title: s.name,
        description: undefined,
        path: `/subcategories`,
      });
    });

    // Search Brands
    const brands = shouldRunCategory("brands")
      ? await Brand.find(isSlashCommand ? {} : { $or: [{ name: searchRegex }] })
          .select("name _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    brands.forEach((b) => {
      results.push({
        id: b._id,
        category: "brands",
        title: b.name,
        description: undefined,
        path: `/brands`,
      });
    });

    // Search Conditions
    const conditions = shouldRunCategory("conditions")
      ? await Condition.find(isSlashCommand ? {} : { $or: [{ name: searchRegex }] })
          .select("name _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    conditions.forEach((c) => {
      results.push({
        id: c._id,
        category: "conditions",
        title: c.name,
        description: undefined,
        path: `/conditions`,
      });
    });

    // Search Users
    const users = shouldRunCategory("users")
      ? await User.find(
          isSlashCommand
            ? {}
            : {
                $or: [
                  { name: searchRegex },
                  { email: searchRegex },
                  { username: searchRegex },
                ],
              },
        )
          .select("name email _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    users.forEach((u) => {
      results.push({
        id: u._id,
        category: "users",
        title: u.name,
        description: u.email,
        path: `/users`,
      });
    });

    // Search Customers
    const customers = shouldRunCategory("customers")
      ? await Customer.find(
          isSlashCommand
            ? {}
            : {
                $or: [
                  { name: searchRegex },
                  { email: searchRegex },
                  { phone: searchRegex },
                ],
              },
        )
          .select("name email phone _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    customers.forEach((c) => {
      results.push({
        id: c._id,
        category: "customers",
        title: c.name,
        description: c.email || c.phone,
        path: `/customers`,
      });
    });

    // Search Vendors
    const vendors = shouldRunCategory("vendors")
      ? await Vendor.find(
          isSlashCommand
            ? {}
            : {
                $or: [
                  { name: searchRegex },
                  { email: searchRegex },
                  { phone: searchRegex },
                ],
              },
        )
          .select("name email phone _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    vendors.forEach((v) => {
      results.push({
        id: v._id,
        category: "vendors",
        title: v.name,
        description: v.email || v.phone,
        path: `/vendors`,
      });
    });

    // Search Employees
    const employees = shouldRunCategory("employees")
      ? await Employee.find(
          isSlashCommand
            ? {}
            : {
                $or: [
                  { name: searchRegex },
                  { email: searchRegex },
                  { phone: searchRegex },
                ],
              },
        )
          .select("name email phone _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    employees.forEach((e) => {
      results.push({
        id: e._id,
        category: "employees",
        title: e.name,
        description: e.email || e.phone,
        path: `/employees`,
      });
    });

    // Search Sales
    const sales = shouldRunCategory("sales")
      ? await Sale.find(
          isSlashCommand
            ? {}
            : {
                $or: [
                  { invoiceNo: searchRegex },
                  { "customer.name": searchRegex },
                  { "customer.phone": searchRegex },
                ],
              },
        )
          .select("invoiceNo customer grandTotal _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    sales.forEach((s) => {
      results.push({
        id: s._id,
        category: "sales",
        title: `Invoice #${s.invoiceNo}`,
        description: `${s.customer.name} - $${s.grandTotal}`,
        path: `/orders?highlight=${s._id}`,
      });
    });

    // Search Purchase Orders
    const purchaseOrders = shouldRunCategory("purchase-orders")
      ? await PurchaseOrder.find(
          isSlashCommand
            ? {}
            : {
                $or: [{ orderNo: searchRegex }, { notes: searchRegex }],
              },
        )
          .select("orderNo vendor totalAmount status _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    purchaseOrders.forEach((po) => {
      results.push({
        id: po._id,
        category: "purchase-orders",
        title: `PO #${po.orderNo}`,
        description: `$${po.totalAmount} - ${po.status}`,
        path: `/purchaseorderslist?highlight=${po._id}`,
      });
    });

    // Search Purchase Receives
    const purchaseReceives = shouldRunCategory("purchase-receives")
      ? await PurchaseReceive.find(
          isSlashCommand
            ? {}
            : {
                $or: [{ receiveNo: searchRegex }, { notes: searchRegex }],
              },
        )
          .select("receiveNo totalAmount status _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    purchaseReceives.forEach((pr) => {
      results.push({
        id: pr._id,
        category: "purchase-receives",
        title: `Receive #${pr.receiveNo}`,
        description: `$${pr.totalAmount} - ${pr.status}`,
        path: `/purchasereceiveslist?highlight=${pr._id}`,
      });
    });

    // Search Bills
    const bills = shouldRunCategory("bills")
      ? await Bill.find(isSlashCommand ? {} : { $or: [{ notes: searchRegex }] })
          .select("vendor totalAmount status dueDate _id")
          .populate("vendor", "name")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    bills.forEach((b) => {
      results.push({
        id: b._id,
        category: "bills",
        title: `Bill - ${b.vendor?.name || "Unknown"}`,
        description: `$${b.totalAmount} - ${b.status}`,
        path: `/bills`,
      });
    });

    // Search Refunds
    const refunds = shouldRunCategory("refunds")
      ? await Refund.find(isSlashCommand ? {} : { $or: [{ reason: searchRegex }] })
          .select("reason amount date _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    refunds.forEach((r) => {
      results.push({
        id: r._id,
        category: "refunds",
        title: `Refund - $${r.amount}`,
        description: r.reason,
        path: `/orders?highlight=${r._id}`,
      });
    });

    // Search Expenses
    const expenses = shouldRunCategory("expenses")
      ? await Expense.find(
          isSlashCommand
            ? {}
            : {
                $or: [{ title: searchRegex }, { notes: searchRegex }],
              },
        )
          .select("title amount expenseDate status _id")
          .limit(isSlashCommand ? commandLimit : 10)
      : [];

    expenses.forEach((e) => {
      results.push({
        id: e._id,
        category: "expenses",
        title: e.title,
        description: `$${e.amount} - ${e.status}`,
        path: `/expenses?highlight=${e._id}`,
      });
    });

    // Add settings as a static result
    if (
      (!isSlashCommand && query.match(/settings?/i)) ||
      commandCategory === "settings"
    ) {
      results.push({
        id: "settings",
        category: "settings",
        title: "Settings",
        description: "Manage application settings",
        path: `/settings`,
      });
    }

    // Add reports as a static result
    if (
      (!isSlashCommand && query.match(/reports?/i)) ||
      commandCategory === "reports"
    ) {
      results.push({
        id: "reports",
        category: "reports",
        title: "Reports",
        description: "View reports and analytics",
        path: `/reports`,
      });
    }

    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export { globalSearch };

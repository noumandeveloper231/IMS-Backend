/**
 * Product Bulk Operations Service
 * Dependency check and bulk delete for products.
 * Products linked to orders (sales) cannot be deleted until removed from those orders.
 */

import mongoose from "mongoose";
import Product from "../models/productModel.js";
import Sale from "../models/saleModel.js";
import { deleteFromBlobIfUrl } from "../utils/blob.js";

const ObjectId = mongoose.Types.ObjectId;

function normalizeProductIds(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new Error("productIds must be a non-empty array");
  }
  const ids = [...new Set(productIds)].filter(Boolean).map((id) => {
    if (!ObjectId.isValid(id)) throw new Error(`Invalid product ID: ${id}`);
    return new ObjectId(id);
  });
  if (ids.length === 0) throw new Error("No valid product IDs provided");
  return ids;
}

/**
 * GET /products/dependencies/:id
 * Returns order count and list of orders (invoice numbers) that reference this product.
 */
export async function getProductDependencies(productId) {
  if (!ObjectId.isValid(productId)) {
    throw new Error("Invalid product ID");
  }
  const id = new ObjectId(productId);
  const product = await Product.findById(id).lean();
  if (!product) {
    throw new Error("Product not found");
  }

  const orders = await Sale.find(
    { "items.product": id },
    { invoiceNo: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .lean();

  const ordersCount = orders.length;
  const ordersList = orders.map((o) => ({
    _id: o._id.toString(),
    invoiceNo: o.invoiceNo,
    createdAt: o.createdAt,
  }));

  return {
    ordersCount,
    hasDependencies: ordersCount > 0,
    orders: ordersList,
  };
}

/**
 * POST /products/check-bulk-dependencies
 * Body: { productIds: string[] }
 * Returns: { operationId, summary: { total, noDeps, needsResolution }, items: [...] }
 */
export async function checkBulkDependencies(productIds) {
  const ids = normalizeProductIds(productIds);

  const products = await Product.find({ _id: { $in: ids } })
    .select("_id title sku")
    .lean();
  const foundIds = new Set(products.map((p) => p._id.toString()));

  const missing = ids.filter((id) => !foundIds.has(id.toString()));
  if (missing.length > 0) {
    throw new Error(`Products not found: ${missing.map((o) => o.toString()).join(", ")}`);
  }

  const orderCounts = await Sale.aggregate([
    { $unwind: "$items" },
    { $match: { "items.product": { $in: ids } } },
    { $group: { _id: "$items.product", count: { $sum: 1 } } },
  ]);

  const orderCountMap = new Map(
    orderCounts.map((o) => [o._id.toString(), o.count])
  );

  const items = products.map((p) => {
    const idStr = p._id.toString();
    const ordersCount = orderCountMap.get(idStr) ?? 0;
    const hasDependencies = ordersCount > 0;

    return {
      id: idStr,
      name: p.title || p.sku || idStr,
      sku: p.sku,
      ordersCount,
      dependenciesCount: ordersCount,
      status: hasDependencies ? "needs_resolution" : "no_deps",
    };
  });

  const noDeps = items.filter((i) => i.status === "no_deps").length;
  const needsResolution = items.filter((i) => i.status === "needs_resolution").length;

  return {
    operationId: new ObjectId().toString(),
    summary: {
      total: items.length,
      noDeps,
      needsResolution,
    },
    items,
  };
}

/**
 * POST /products/bulk-delete-preview
 * Only products with no order dependencies can be deleted.
 * Body: { productIds: string[] }
 */
export async function bulkDeletePreview(productIds) {
  const result = await checkBulkDependencies(productIds);
  const toDelete = result.items.filter((i) => i.status === "no_deps");
  const blocked = result.items.filter((i) => i.status === "needs_resolution");

  return {
    summary: {
      toDelete: toDelete.length,
      blocked: blocked.length,
      total: result.items.length,
    },
    toDelete: toDelete.map((i) => ({ id: i.id, name: i.name, sku: i.sku })),
    blocked: blocked.map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      ordersCount: i.ordersCount,
    })),
  };
}

/**
 * POST /products/bulk-delete
 * Deletes only products that have no order dependencies. Returns deleted and blocked lists.
 */
export async function executeBulkDelete(productIds) {
  const result = await checkBulkDependencies(productIds);
  const toDeleteIds = result.items
    .filter((i) => i.status === "no_deps")
    .map((i) => new ObjectId(i.id));

  if (toDeleteIds.length === 0) {
    return {
      success: true,
      message: "No products could be deleted (all are linked to orders).",
      deleted: [],
      deletedCount: 0,
      blocked: result.items.filter((i) => i.status === "needs_resolution").map((i) => ({ id: i.id, name: i.name, ordersCount: i.ordersCount })),
      blockedCount: result.summary.needsResolution,
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const products = await Product.find({ _id: { $in: toDeleteIds } })
      .session(session)
      .lean();

    for (const product of products) {
      if (Array.isArray(product.images)) {
        for (const img of product.images) {
          if (img) await deleteFromBlobIfUrl(img);
        }
      }
      if (product.image) {
        await deleteFromBlobIfUrl(product.image);
      }
      await Product.findByIdAndDelete(product._id).session(session);
    }

    await session.commitTransaction();

    const blocked = result.items
      .filter((i) => i.status === "needs_resolution")
      .map((i) => ({ id: i.id, name: i.name, ordersCount: i.ordersCount }));

    return {
      success: true,
      message: `Deleted ${products.length} product(s).${blocked.length > 0 ? ` ${blocked.length} product(s) could not be deleted (linked to orders).` : ""}`,
      deleted: products.map((p) => ({ id: p._id.toString(), name: p.title || p.sku })),
      deletedCount: products.length,
      blocked,
      blockedCount: blocked.length,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

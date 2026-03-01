/**
 * Category Bulk Operations Service
 * Enterprise-grade bulk dependency check, preview, and transactional delete.
 * Uses Mongoose transactions for all-or-nothing execution with rollback on failure.
 *
 * Note: Current implementation uses hard delete. To use soft delete (isDeleted),
 * replace delete operations with updateOne({ _id }, { $set: { isDeleted: true, deletedAt: new Date() } })
 * and ensure all queries filter by isDeleted: { $ne: true }.
 */

import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import Subcategory from "../models/subcategoryModel.js";
import Product from "../models/productModel.js";
import { deleteFromBlobIfUrl } from "../utils/blob.js";

const ObjectId = mongoose.Types.ObjectId;

/**
 * Validate and normalize category IDs. Returns array of valid ObjectIds.
 */
function normalizeCategoryIds(categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    throw new Error("categoryIds must be a non-empty array");
  }
  const ids = [...new Set(categoryIds)].filter(Boolean).map((id) => {
    if (!ObjectId.isValid(id)) throw new Error(`Invalid category ID: ${id}`);
    return new ObjectId(id);
  });
  if (ids.length === 0) throw new Error("No valid category IDs provided");
  return ids;
}

/**
 * Check dependencies for multiple categories in one round-trip.
 * POST /categories/check-bulk-dependencies
 * Body: { categoryIds: string[] }
 *
 * Returns: { operationId, summary: { total, noDeps, needsResolution }, items: [...] }
 */
export async function checkBulkDependencies(categoryIds) {
  const ids = normalizeCategoryIds(categoryIds);

  const categories = await Category.find({ _id: { $in: ids } }).lean();
  const foundIds = new Set(categories.map((c) => c._id.toString()));

  const missing = ids.filter((id) => !foundIds.has(id.toString()));
  if (missing.length > 0) {
    throw new Error(`Categories not found: ${missing.map((o) => o.toString()).join(", ")}`);
  }

  const [subcounts, productCounts] = await Promise.all([
    Subcategory.aggregate([
      { $match: { category: { $in: ids } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: { category: { $in: ids } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  const subMap = new Map(subcounts.map((s) => [s._id.toString(), s.count]));
  const productMap = new Map(productCounts.map((p) => [p._id.toString(), p.count]));

  const items = categories.map((cat) => {
    const idStr = cat._id.toString();
    const subcategoriesCount = subMap.get(idStr) ?? 0;
    const productsCount = productMap.get(idStr) ?? 0;
    const dependenciesCount = subcategoriesCount + productsCount;
    const needsResolution = dependenciesCount > 0;

    return {
      id: idStr,
      name: cat.name,
      subcategoriesCount,
      productsCount,
      dependenciesCount,
      status: needsResolution ? "needs_resolution" : "no_deps",
      resolutionAction: null,
      transferTarget: null,
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
 * Resolution plan: array of { id, action: "delete" | "cascade" | "transfer", transferTo?: string }
 * - delete: no dependencies, simple delete
 * - cascade: delete category and all its subcategories/products
 * - transfer: move subcategories/products to transferTo, then delete category
 */
function validateResolutionPlan(plan, categoryIdsSet) {
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new Error("Resolution plan must be a non-empty array");
  }
  const validActions = new Set(["delete", "cascade", "transfer"]);
  for (const item of plan) {
    if (!item.id) throw new Error("Each plan item must have id");
    if (!categoryIdsSet.has(item.id)) throw new Error(`Category ${item.id} is not in the selection`);
    if (!validActions.has(item.action)) {
      throw new Error(`Invalid action "${item.action}" for category ${item.id}`);
    }
    if (item.action === "transfer") {
      if (!item.transferTo || typeof item.transferTo !== "string") {
        throw new Error(`transferTo is required for transfer action (category ${item.id})`);
      }
      if (categoryIdsSet.has(item.transferTo)) {
        throw new Error(
          `Transfer target ${item.transferTo} cannot be in the delete list (category ${item.id})`
        );
      }
      if (!ObjectId.isValid(item.transferTo)) {
        throw new Error(`Invalid transferTo ID for category ${item.id}`);
      }
    }
  }
}

/**
 * Simulate bulk delete without committing. Re-validates dependencies and returns preview.
 * POST /categories/bulk-delete-preview
 * Body: { categoryIds: string[], resolutionPlan: { id, action, transferTo? }[] }
 */
export async function bulkDeletePreview(categoryIds, resolutionPlan) {
  const ids = normalizeCategoryIds(categoryIds);
  const categoryIdsSet = new Set(ids.map((o) => o.toString()));

  validateResolutionPlan(resolutionPlan, categoryIdsSet);

  const planMap = new Map(
    resolutionPlan.map((p) => [
      p.id,
      { action: p.action, transferTo: p.action === "transfer" ? p.transferTo : null },
    ])
  );

  let totalSubcategoriesAffected = 0;
  let totalProductsAffected = 0;
  const categoriesToDelete = [];

  for (const id of ids) {
    const idStr = id.toString();
    const plan = planMap.get(idStr);
    if (!plan) throw new Error(`Missing resolution plan for category ${idStr}`);

    const category = await Category.findById(id).lean();
    if (!category) throw new Error(`Category not found: ${idStr}`);

    const [subCount, productCount] = await Promise.all([
      Subcategory.countDocuments({ category: id }),
      Product.countDocuments({ category: id }),
    ]);

    if (plan.action === "delete" && (subCount > 0 || productCount > 0)) {
      throw new Error(
        `Category "${category.name}" has dependencies but plan says delete. Use cascade or transfer.`
      );
    }
    if (plan.action === "transfer") {
      const targetExists = await Category.findById(plan.transferTo).lean();
      if (!targetExists) throw new Error(`Transfer target category not found: ${plan.transferTo}`);
    }

    categoriesToDelete.push({
      id: idStr,
      name: category.name,
      action: plan.action,
      transferTo: plan.transferTo,
      subcategoriesCount: subCount,
      productsCount: productCount,
    });

    if (plan.action === "cascade") {
      totalSubcategoriesAffected += subCount;
      totalProductsAffected += productCount;
    } else if (plan.action === "transfer") {
      totalSubcategoriesAffected += subCount;
      totalProductsAffected += productCount;
    }
  }

  return {
    summary: {
      categoriesToDelete: categoriesToDelete.length,
      totalSubcategoriesAffected,
      totalProductsAffected,
    },
    categories: categoriesToDelete,
  };
}

/**
 * Execute bulk delete inside a Mongoose transaction. Re-validates dependencies at execution time.
 * On any failure, entire transaction is rolled back.
 * POST /categories/bulk-delete
 * Body: { categoryIds: string[], resolutionPlan: { id, action, transferTo? }[] }
 */
export async function executeBulkDelete(categoryIds, resolutionPlan) {
  const ids = normalizeCategoryIds(categoryIds);
  const categoryIdsSet = new Set(ids.map((o) => o.toString()));

  validateResolutionPlan(resolutionPlan, categoryIdsSet);

  const planMap = new Map(
    resolutionPlan.map((p) => [
      p.id,
      { action: p.action, transferTo: p.action === "transfer" ? new ObjectId(p.transferTo) : null },
    ])
  );

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deleted = [];

    for (const id of ids) {
      const idStr = id.toString();
      const plan = planMap.get(idStr);
      if (!plan) {
        await session.abortTransaction();
        throw new Error(`Missing resolution plan for category ${idStr}`);
      }

      const category = await Category.findById(id).session(session);
      if (!category) {
        await session.abortTransaction();
        throw new Error(`Category not found: ${idStr}`);
      }

      const [subCount, productCount] = await Promise.all([
        Subcategory.countDocuments({ category: id }).session(session),
        Product.countDocuments({ category: id }).session(session),
      ]);

      if (plan.action === "delete") {
        if (subCount > 0 || productCount > 0) {
          await session.abortTransaction();
          throw new Error(
            `Category "${category.name}" has dependencies (${subCount} subcategories, ${productCount} products). Re-check dependencies.`
          );
        }
      }

      if (plan.action === "transfer") {
        const target = await Category.findById(plan.transferTo).session(session);
        if (!target) {
          await session.abortTransaction();
          throw new Error(`Transfer target category not found: ${plan.transferTo}`);
        }
        if (plan.transferTo.equals(id)) {
          await session.abortTransaction();
          throw new Error("Cannot transfer to the same category");
        }
        if (categoryIdsSet.has(plan.transferTo.toString())) {
          await session.abortTransaction();
          throw new Error("Transfer target cannot be in the delete list");
        }

        await Subcategory.updateMany(
          { category: id },
          { $set: { category: plan.transferTo } }
        ).session(session);

        await Product.updateMany(
          { category: id },
          { $set: { category: plan.transferTo } }
        ).session(session);
      }

      if (plan.action === "cascade") {
        const subcategories = await Subcategory.find({ category: id })
          .session(session)
          .lean();
        for (const sub of subcategories) {
          await Subcategory.findByIdAndDelete(sub._id).session(session);
        }
        const products = await Product.find({ category: id }).session(session).lean();
        for (const product of products) {
          if (Array.isArray(product.images)) {
            for (const img of product.images) {
              if (img) await deleteFromBlobIfUrl(img);
            }
          }
          if (product.image) await deleteFromBlobIfUrl(product.image);
          await Product.findByIdAndDelete(product._id).session(session);
        }
      }

      if (category.image) {
        await deleteFromBlobIfUrl(category.image);
      }
      await Category.findByIdAndDelete(id).session(session);
      deleted.push({ id: idStr, name: category.name });
    }

    await session.commitTransaction();

    return {
      success: true,
      message: `Successfully deleted ${deleted.length} categories`,
      deleted,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

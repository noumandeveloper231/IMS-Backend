import mongoose from "mongoose";
import Subcategory from "../models/subcategoryModel.js";
import Product from "../models/productModel.js";
import { deleteFromBlobIfUrl } from "../utils/blob.js";

const ObjectId = mongoose.Types.ObjectId;

function normalizeSubcategoryIds(subcategoryIds) {
  if (!Array.isArray(subcategoryIds) || subcategoryIds.length === 0) {
    throw new Error("subcategoryIds must be a non-empty array");
  }
  const ids = [...new Set(subcategoryIds)]
    .filter(Boolean)
    .map((id) => {
      if (!ObjectId.isValid(id)) throw new Error(`Invalid subcategory ID: ${id}`);
      return new ObjectId(id);
    });
  if (ids.length === 0) throw new Error("No valid subcategory IDs provided");
  return ids;
}

export async function checkBulkDependencies(subcategoryIds) {
  const ids = normalizeSubcategoryIds(subcategoryIds);

  const subcategories = await Subcategory.find({ _id: { $in: ids } }).lean();
  const foundIds = new Set(subcategories.map((s) => s._id.toString()));

  const missing = ids.filter((id) => !foundIds.has(id.toString()));
  if (missing.length > 0) {
    throw new Error(
      `Subcategories not found: ${missing.map((o) => o.toString()).join(", ")}`,
    );
  }

  const productCounts = await Product.aggregate([
    { $match: { subcategory: { $in: ids } } },
    { $group: { _id: "$subcategory", count: { $sum: 1 } } },
  ]);

  const productMap = new Map(productCounts.map((p) => [p._id.toString(), p.count]));

  const items = subcategories.map((sub) => {
    const idStr = sub._id.toString();
    const productsCount = productMap.get(idStr) ?? 0;
    const dependenciesCount = productsCount;
    const needsResolution = dependenciesCount > 0;

    return {
      id: idStr,
      name: sub.name,
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

function validateResolutionPlan(plan, subcategoryIdsSet) {
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new Error("Resolution plan must be a non-empty array");
  }
  const validActions = new Set(["delete", "cascade", "transfer"]);
  for (const item of plan) {
    if (!item.id) throw new Error("Each plan item must have id");
    if (!subcategoryIdsSet.has(item.id)) {
      throw new Error(`Subcategory ${item.id} is not in the selection`);
    }
    if (!validActions.has(item.action)) {
      throw new Error(`Invalid action "${item.action}" for subcategory ${item.id}`);
    }
    if (item.action === "transfer") {
      if (!item.transferTo || typeof item.transferTo !== "string") {
        throw new Error(
          `transferTo is required for transfer action (subcategory ${item.id})`,
        );
      }
      if (subcategoryIdsSet.has(item.transferTo)) {
        throw new Error(
          `Transfer target ${item.transferTo} cannot be in the delete list (subcategory ${item.id})`,
        );
      }
      if (!ObjectId.isValid(item.transferTo)) {
        throw new Error(`Invalid transferTo ID for subcategory ${item.id}`);
      }
    }
  }
}

export async function bulkDeletePreview(subcategoryIds, resolutionPlan) {
  const ids = normalizeSubcategoryIds(subcategoryIds);
  const subcategoryIdsSet = new Set(ids.map((o) => o.toString()));

  validateResolutionPlan(resolutionPlan, subcategoryIdsSet);

  const planMap = new Map(
    resolutionPlan.map((p) => [
      p.id,
      { action: p.action, transferTo: p.action === "transfer" ? p.transferTo : null },
    ]),
  );

  let totalProductsAffected = 0;
  const subcategoriesToDelete = [];

  for (const id of ids) {
    const idStr = id.toString();
    const plan = planMap.get(idStr);
    if (!plan) throw new Error(`Missing resolution plan for subcategory ${idStr}`);

    const sub = await Subcategory.findById(id).lean();
    if (!sub) throw new Error(`Subcategory not found: ${idStr}`);

    const productsCount = await Product.countDocuments({ subcategory: id });

    if (plan.action === "delete" && productsCount > 0) {
      throw new Error(
        `Subcategory "${sub.name}" has dependencies but plan says delete. Use cascade or transfer.`,
      );
    }
    if (plan.action === "transfer") {
      const targetExists = await Subcategory.findById(plan.transferTo).lean();
      if (!targetExists) {
        throw new Error(`Transfer target subcategory not found: ${plan.transferTo}`);
      }
    }

    subcategoriesToDelete.push({
      id: idStr,
      name: sub.name,
      action: plan.action,
      transferTo: plan.transferTo,
      productsCount,
    });

    if (plan.action === "cascade" || plan.action === "transfer") {
      totalProductsAffected += productsCount;
    }
  }

  return {
    summary: {
      subcategoriesToDelete: subcategoriesToDelete.length,
      totalProductsAffected,
    },
    subcategories: subcategoriesToDelete,
  };
}

export async function executeBulkDelete(subcategoryIds, resolutionPlan) {
  const ids = normalizeSubcategoryIds(subcategoryIds);
  const subcategoryIdsSet = new Set(ids.map((o) => o.toString()));

  validateResolutionPlan(resolutionPlan, subcategoryIdsSet);

  const planMap = new Map(
    resolutionPlan.map((p) => [
      p.id,
      {
        action: p.action,
        transferTo:
          p.action === "transfer" ? new ObjectId(p.transferTo) : null,
      },
    ]),
  );

  const deleted = [];

  for (const id of ids) {
    const idStr = id.toString();
    const plan = planMap.get(idStr);
    if (!plan) {
      throw new Error(`Missing resolution plan for subcategory ${idStr}`);
    }

    const sub = await Subcategory.findById(id);
    if (!sub) {
      throw new Error(`Subcategory not found: ${idStr}`);
    }

    const productsCount = await Product.countDocuments({ subcategory: id });

    if (plan.action === "delete") {
      if (productsCount > 0) {
        throw new Error(
          `Subcategory "${sub.name}" has dependencies (${productsCount} products). Re-check dependencies.`,
        );
      }
    }

    if (plan.action === "transfer") {
      const target = await Subcategory.findById(plan.transferTo);
      if (!target) {
        throw new Error(
          `Transfer target subcategory not found: ${plan.transferTo}`,
        );
      }
      if (plan.transferTo.equals(id)) {
        throw new Error("Cannot transfer to the same subcategory");
      }
      if (subcategoryIdsSet.has(plan.transferTo.toString())) {
        throw new Error("Transfer target cannot be in the delete list");
      }

      await Product.updateMany(
        { subcategory: id },
        { $set: { subcategory: plan.transferTo } },
      );
    }

    if (plan.action === "cascade") {
      const products = await Product.find({ subcategory: id }).lean();
      for (const product of products) {
        if (Array.isArray(product.images)) {
          for (const img of product.images) {
            if (img) await deleteFromBlobIfUrl(img);
          }
        }
        if (product.image) await deleteFromBlobIfUrl(product.image);
        await Product.findByIdAndDelete(product._id);
      }
    }

    await Subcategory.findByIdAndDelete(id);
    deleted.push({ id: idStr, name: sub.name });
  }

  return {
    success: true,
    message: `Successfully deleted ${deleted.length} subcategories`,
    deleted,
  };
}



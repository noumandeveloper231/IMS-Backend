import mongoose from "mongoose";
import Brand from "../models/brandModel.js";
import Product from "../models/productModel.js";
import { deleteFromBlobIfUrl } from "../utils/blob.js";

const ObjectId = mongoose.Types.ObjectId;

function normalizeBrandIds(brandIds) {
  if (!Array.isArray(brandIds) || brandIds.length === 0) {
    throw new Error("brandIds must be a non-empty array");
  }
  const ids = [...new Set(brandIds)]
    .filter(Boolean)
    .map((id) => {
      if (!ObjectId.isValid(id)) throw new Error(`Invalid brand ID: ${id}`);
      return new ObjectId(id);
    });
  if (ids.length === 0) throw new Error("No valid brand IDs provided");
  return ids;
}

export async function checkBulkDependencies(brandIds) {
  const ids = normalizeBrandIds(brandIds);

  const brands = await Brand.find({ _id: { $in: ids } }).lean();
  const foundIds = new Set(brands.map((b) => b._id.toString()));

  const missing = ids.filter((id) => !foundIds.has(id.toString()));
  if (missing.length > 0) {
    throw new Error(
      `Brands not found: ${missing.map((o) => o.toString()).join(", ")}`,
    );
  }

  const productCounts = await Product.aggregate([
    { $match: { brand: { $in: ids } } },
    { $group: { _id: "$brand", count: { $sum: 1 } } },
  ]);

  const productMap = new Map(productCounts.map((p) => [p._id.toString(), p.count]));

  const items = brands.map((brand) => {
    const idStr = brand._id.toString();
    const productsCount = productMap.get(idStr) ?? 0;
    const dependenciesCount = productsCount;
    const needsResolution = dependenciesCount > 0;

    return {
      id: idStr,
      name: brand.name,
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

function validateResolutionPlan(plan, brandIdsSet) {
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new Error("Resolution plan must be a non-empty array");
  }
  const validActions = new Set(["delete", "cascade", "transfer"]);
  for (const item of plan) {
    if (!item.id) throw new Error("Each plan item must have id");
    if (!brandIdsSet.has(item.id)) {
      throw new Error(`Brand ${item.id} is not in the selection`);
    }
    if (!validActions.has(item.action)) {
      throw new Error(`Invalid action "${item.action}" for brand ${item.id}`);
    }
    if (item.action === "transfer") {
      if (!item.transferTo || typeof item.transferTo !== "string") {
        throw new Error(
          `transferTo is required for transfer action (brand ${item.id})`,
        );
      }
      if (brandIdsSet.has(item.transferTo)) {
        throw new Error(
          `Transfer target ${item.transferTo} cannot be in the delete list (brand ${item.id})`,
        );
      }
      if (!ObjectId.isValid(item.transferTo)) {
        throw new Error(`Invalid transferTo ID for brand ${item.id}`);
      }
    }
  }
}

export async function bulkDeletePreview(brandIds, resolutionPlan) {
  const ids = normalizeBrandIds(brandIds);
  const brandIdsSet = new Set(ids.map((o) => o.toString()));

  validateResolutionPlan(resolutionPlan, brandIdsSet);

  const planMap = new Map(
    resolutionPlan.map((p) => [
      p.id,
      { action: p.action, transferTo: p.action === "transfer" ? p.transferTo : null },
    ]),
  );

  let totalProductsAffected = 0;
  const brandsToDelete = [];

  for (const id of ids) {
    const idStr = id.toString();
    const plan = planMap.get(idStr);
    if (!plan) throw new Error(`Missing resolution plan for brand ${idStr}`);

    const brand = await Brand.findById(id).lean();
    if (!brand) throw new Error(`Brand not found: ${idStr}`);

    const productsCount = await Product.countDocuments({ brand: id });

    if (plan.action === "delete" && productsCount > 0) {
      throw new Error(
        `Brand "${brand.name}" has dependencies but plan says delete. Use cascade or transfer.`,
      );
    }
    if (plan.action === "transfer") {
      const targetExists = await Brand.findById(plan.transferTo).lean();
      if (!targetExists) {
        throw new Error(`Transfer target brand not found: ${plan.transferTo}`);
      }
    }

    brandsToDelete.push({
      id: idStr,
      name: brand.name,
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
      brandsToDelete: brandsToDelete.length,
      totalProductsAffected,
    },
    brands: brandsToDelete,
  };
}

export async function executeBulkDelete(brandIds, resolutionPlan) {
  const ids = normalizeBrandIds(brandIds);
  const brandIdsSet = new Set(ids.map((o) => o.toString()));

  validateResolutionPlan(resolutionPlan, brandIdsSet);

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
      throw new Error(`Missing resolution plan for brand ${idStr}`);
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      throw new Error(`Brand not found: ${idStr}`);
    }

    const productsCount = await Product.countDocuments({ brand: id });

    if (plan.action === "delete") {
      if (productsCount > 0) {
        throw new Error(
          `Brand "${brand.name}" has dependencies (${productsCount} products). Re-check dependencies.`,
        );
      }
    }

    if (plan.action === "transfer") {
      const target = await Brand.findById(plan.transferTo);
      if (!target) {
        throw new Error(
          `Transfer target brand not found: ${plan.transferTo}`,
        );
      }
      if (plan.transferTo.equals(id)) {
        throw new Error("Cannot transfer to the same brand");
      }
      if (brandIdsSet.has(plan.transferTo.toString())) {
        throw new Error("Transfer target cannot be in the delete list");
      }

      await Product.updateMany(
        { brand: id },
        { $set: { brand: plan.transferTo } },
      );
    }

    if (plan.action === "cascade") {
      const products = await Product.find({ brand: id }).lean();
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

    if (brand.image) {
      await deleteFromBlobIfUrl(brand.image);
    }
    await Brand.findByIdAndDelete(id);
    deleted.push({ id: idStr, name: brand.name });
  }

  return {
    success: true,
    message: `Successfully deleted ${deleted.length} brands`,
    deleted,
  };
}

import mongoose from "mongoose";
import Condition from "../models/conditionModel.js";
import Product from "../models/productModel.js";
import { deleteFromBlobIfUrl } from "../utils/blob.js";

const ObjectId = mongoose.Types.ObjectId;

function normalizeConditionIds(conditionIds) {
  if (!Array.isArray(conditionIds) || conditionIds.length === 0) {
    throw new Error("conditionIds must be a non-empty array");
  }
  const ids = [...new Set(conditionIds)]
    .filter(Boolean)
    .map((id) => {
      if (!ObjectId.isValid(id)) throw new Error(`Invalid condition ID: ${id}`);
      return new ObjectId(id);
    });
  if (ids.length === 0) throw new Error("No valid condition IDs provided");
  return ids;
}

export async function checkBulkDependencies(conditionIds) {
  const ids = normalizeConditionIds(conditionIds);

  const conditions = await Condition.find({ _id: { $in: ids } }).lean();
  const foundIds = new Set(conditions.map((c) => c._id.toString()));

  const missing = ids.filter((id) => !foundIds.has(id.toString()));
  if (missing.length > 0) {
    throw new Error(
      `Conditions not found: ${missing.map((o) => o.toString()).join(", ")}`,
    );
  }

  const productCounts = await Product.aggregate([
    { $match: { condition: { $in: ids } } },
    { $group: { _id: "$condition", count: { $sum: 1 } } },
  ]);

  const productMap = new Map(productCounts.map((p) => [p._id.toString(), p.count]));

  const items = conditions.map((cond) => {
    const idStr = cond._id.toString();
    const productsCount = productMap.get(idStr) ?? 0;
    const dependenciesCount = productsCount;
    const needsResolution = dependenciesCount > 0;

    return {
      id: idStr,
      name: cond.name,
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

function validateResolutionPlan(plan, conditionIdsSet) {
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new Error("Resolution plan must be a non-empty array");
  }
  const validActions = new Set(["delete", "cascade", "transfer"]);
  for (const item of plan) {
    if (!item.id) throw new Error("Each plan item must have id");
    if (!conditionIdsSet.has(item.id)) {
      throw new Error(`Condition ${item.id} is not in the selection`);
    }
    if (!validActions.has(item.action)) {
      throw new Error(`Invalid action "${item.action}" for condition ${item.id}`);
    }
    if (item.action === "transfer") {
      if (!item.transferTo || typeof item.transferTo !== "string") {
        throw new Error(
          `transferTo is required for transfer action (condition ${item.id})`,
        );
      }
      if (conditionIdsSet.has(item.transferTo)) {
        throw new Error(
          `Transfer target ${item.transferTo} cannot be in the delete list (condition ${item.id})`,
        );
      }
      if (!ObjectId.isValid(item.transferTo)) {
        throw new Error(`Invalid transferTo ID for condition ${item.id}`);
      }
    }
  }
}

export async function bulkDeletePreview(conditionIds, resolutionPlan) {
  const ids = normalizeConditionIds(conditionIds);
  const conditionIdsSet = new Set(ids.map((o) => o.toString()));

  validateResolutionPlan(resolutionPlan, conditionIdsSet);

  const planMap = new Map(
    resolutionPlan.map((p) => [
      p.id,
      { action: p.action, transferTo: p.action === "transfer" ? p.transferTo : null },
    ]),
  );

  let totalProductsAffected = 0;
  const conditionsToDelete = [];

  for (const id of ids) {
    const idStr = id.toString();
    const plan = planMap.get(idStr);
    if (!plan) throw new Error(`Missing resolution plan for condition ${idStr}`);

    const condition = await Condition.findById(id).lean();
    if (!condition) throw new Error(`Condition not found: ${idStr}`);

    const productsCount = await Product.countDocuments({ condition: id });

    if (plan.action === "delete" && productsCount > 0) {
      throw new Error(
        `Condition "${condition.name}" has dependencies but plan says delete. Use cascade or transfer.`,
      );
    }
    if (plan.action === "transfer") {
      const targetExists = await Condition.findById(plan.transferTo).lean();
      if (!targetExists) {
        throw new Error(`Transfer target condition not found: ${plan.transferTo}`);
      }
    }

    conditionsToDelete.push({
      id: idStr,
      name: condition.name,
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
      conditionsToDelete: conditionsToDelete.length,
      totalProductsAffected,
    },
    conditions: conditionsToDelete,
  };
}

export async function executeBulkDelete(conditionIds, resolutionPlan) {
  const ids = normalizeConditionIds(conditionIds);
  const conditionIdsSet = new Set(ids.map((o) => o.toString()));

  validateResolutionPlan(resolutionPlan, conditionIdsSet);

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
      throw new Error(`Missing resolution plan for condition ${idStr}`);
    }

    const condition = await Condition.findById(id);
    if (!condition) {
      throw new Error(`Condition not found: ${idStr}`);
    }

    const productsCount = await Product.countDocuments({ condition: id });

    if (plan.action === "delete") {
      if (productsCount > 0) {
        throw new Error(
          `Condition "${condition.name}" has dependencies (${productsCount} products). Re-check dependencies.`,
        );
      }
    }

    if (plan.action === "transfer") {
      const target = await Condition.findById(plan.transferTo);
      if (!target) {
        throw new Error(
          `Transfer target condition not found: ${plan.transferTo}`,
        );
      }
      if (plan.transferTo.equals(id)) {
        throw new Error("Cannot transfer to the same condition");
      }
      if (conditionIdsSet.has(plan.transferTo.toString())) {
        throw new Error("Transfer target cannot be in the delete list");
      }

      await Product.updateMany(
        { condition: id },
        { $set: { condition: plan.transferTo } },
      );
    }

    if (plan.action === "cascade") {
      const products = await Product.find({ condition: id }).lean();
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

    if (condition.image) {
      await deleteFromBlobIfUrl(condition.image);
    }
    await Condition.findByIdAndDelete(id);
    deleted.push({ id: idStr, name: condition.name });
  }

  return {
    success: true,
    message: `Successfully deleted ${deleted.length} conditions`,
    deleted,
  };
}

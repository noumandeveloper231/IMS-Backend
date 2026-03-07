// controllers/conditionController.js
import mongoose from "mongoose";
import Condition from "../models/conditionModel.js";
import Product from "../models/productModel.js";
import { uploadToBlob, deleteFromBlobIfUrl } from "../utils/blob.js";
import {
  checkBulkDependencies as checkBulkDependenciesService,
  bulkDeletePreview as bulkDeletePreviewService,
  executeBulkDelete as executeBulkDeleteService,
} from "../services/conditionBulkService.js";

// ✅ Upload condition image only (returns URL for use in bulk import etc.)
export const uploadConditionImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }
    const imageUrl = await uploadToBlob(req.file, "conditions");
    res.status(200).json({
      success: true,
      url: imageUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
};

// ✅ Delete condition image from blob by URL (for import: replace image from device)
export const deleteConditionImageByUrl = async (req, res) => {
  try {
    const { imageUrl } = req.body || {};
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      return res.status(400).json({
        success: false,
        message: "Valid image URL required",
      });
    }
    await deleteFromBlobIfUrl(imageUrl);
    res.status(200).json({ success: true, message: "Image removed" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete image",
      error: error.message,
    });
  }
};

// ✅ Create condition
export const createCondition = async (req, res) => {
  try {
    let { name, image: imageId, description, tags, exampleProductImages } = req.body || {};
    if (typeof tags === "string") {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = [];
      }
    }
    if (typeof exampleProductImages === "string") {
      try {
        exampleProductImages = JSON.parse(exampleProductImages);
      } catch {
        exampleProductImages = [];
      }
    }
    if (!Array.isArray(tags)) tags = [];
    if (!Array.isArray(exampleProductImages)) exampleProductImages = [];
    if (typeof imageId === "string") imageId = imageId.trim();
    if (Array.isArray(imageId)) imageId = imageId[0];
    let imageRef = null;
    let imageUrl = null;
    if (imageId && mongoose.Types.ObjectId.isValid(imageId)) {
      imageRef = imageId;
    } else if (req.file) {
      imageUrl = await uploadToBlob(req.file, "conditions");
    }

    const existingCondition = await Condition.findOne({ name: name?.trim() });
    if (existingCondition) {
      return res.json({
        success: false,
        message: "This Condition already exists!",
      });
    }

    const newCondition = new Condition({
      name: name?.trim(),
      imageRef,
      image: imageUrl,
      description: description || null,
      tags: tags || [],
      exampleProductImages: exampleProductImages || [],
    });
    await newCondition.save();

    const populated = await Condition.findById(newCondition._id).populate("imageRef").lean();
    const payload = populated
      ? { ...populated, imageUrl: populated.imageRef?.url || populated.image }
      : newCondition;
    res.json({
      success: true,
      message: "Condition created successfully",
      Condition: payload,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create Condition",
      error: error.message,
    });
  }
};
// New function for bulk condition creation
export const createBulkConditions = async (req, res) => {
  try {
    const conditionsData = req.body; // Yahan Excel se data array ki shakal mein aayega

    const createdConditions = [];
    for (const conditionData of conditionsData) {
      const { name, image } = conditionData; // Yahan name aur image dono mil jayenge

      // Check karein ke Condition pehle se maujood hai ya nahi
      const existingCondition = await Condition.findOne({
        name: name.trim(),
      });
      if (existingCondition) {
        console.log(`Condition already exists, skipping: ${name}`);
        continue; // Existing condition ko skip karein
      }

      const newCondition = new Condition({
        name: name.trim(),
        image, // Yahan image ka path seedha save ho jayega
      });
      await newCondition.save();
      createdConditions.push(newCondition);
    }

    res.json({
      success: true,
      message: `${createdConditions.length} conditions created successfully`,
      conditions: createdConditions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create conditions in bulk",
      error: error.message,
    });
  }
};
// ✅ Get condition dependencies (products count)
export const getConditionDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const condition = await Condition.findById(id);
    if (!condition) {
      return res.status(404).json({
        success: false,
        message: "Condition not found",
      });
    }
    const productsCount = await Product.countDocuments({ condition: id });
    res.status(200).json({
      success: true,
      productsCount: productsCount || 0,
      hasDependencies: (productsCount || 0) > 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get condition dependencies",
      error: error.message,
    });
  }
};

// ✅ Transfer condition dependencies to another condition, then delete
export const transferConditionDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const { transferToConditionId } = req.body;
    if (!transferToConditionId) {
      return res.status(400).json({
        success: false,
        message: "transferToConditionId is required",
      });
    }
    const condition = await Condition.findById(id);
    if (!condition) {
      return res.status(404).json({
        success: false,
        message: "Condition not found",
      });
    }
    const targetCondition = await Condition.findById(transferToConditionId);
    if (!targetCondition || targetCondition._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "Target condition not found or cannot transfer to same condition",
      });
    }
    const conditionObjId = new mongoose.Types.ObjectId(id);
    const targetObjId = new mongoose.Types.ObjectId(transferToConditionId);
    await Product.updateMany(
      { condition: conditionObjId },
      { $set: { condition: targetObjId } }
    );
    if (condition.image) {
      await deleteFromBlobIfUrl(condition.image);
    }
    await Condition.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Dependencies transferred and condition deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to transfer dependencies " + error.message,
      error: error.message,
    });
  }
};

// ✅ Get all conditions
export const getConditions = async (req, res) => {
  try {
    const conditions = await Condition.find();
    res.status(200).json({
      success: true,
      conditions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve conditions",
      error: error.message,
    });
  }
};
// ✅ Get all brands with product count
export const getConditionsCount = async (req, res) => {
  try {
    const conditions = await Condition.aggregate([
      {
        $addFields: {
          imageId: {
            $cond: [
              {
                $and: [
                  { $eq: [{ $type: "$imageRef" }, "string"] },
                  { $gt: [{ $strLenCP: { $ifNull: ["$imageRef", ""] } }, 0] },
                ],
              },
              { $toObjectId: "$imageRef" },
              {
                $cond: [
                  { $in: [{ $type: "$imageRef" }, ["objectId", "object"]] },
                  "$imageRef",
                  null,
                ],
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "condition",
          as: "products",
        },
      },
      {
        $lookup: {
          from: "media",
          let: { iid: "$imageId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$iid"] } } },
            { $project: { url: 1 } },
          ],
          as: "imageDocMedia",
        },
      },
      {
        $lookup: {
          from: "medias",
          let: { iid: "$imageId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$iid"] } } },
            { $project: { url: 1 } },
          ],
          as: "imageDocMedias",
        },
      },
      {
        $addFields: {
          imageDoc: {
            $cond: {
              if: { $gt: [{ $size: "$imageDocMedia" }, 0] },
              then: "$imageDocMedia",
              else: "$imageDocMedias",
            },
          },
        },
      },
      {
        $addFields: {
          productCount: { $size: "$products" },
          imageUrl: {
            $cond: {
              if: { $gt: [{ $size: "$imageDoc" }, 0] },
              then: { $arrayElemAt: ["$imageDoc.url", 0] },
              else: "$image",
            },
          },
        },
      },
      {
        $project: {
          products: 0,
          imageDoc: 0,
          imageDocMedia: 0,
          imageDocMedias: 0,
          imageId: 0,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      conditions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve conditions",
      error: error.message,
    });
  }
};
// ✅ Get single condition by ID
export const getConditionById = async (req, res) => {
  try {
    const id = req.params.id;
    const userExist = await Condition.findById(id).populate("imageRef").lean();
    if (!userExist) {
      return res.status(404).json({ msg: "Condition not found" });
    }
    const withUrl = { ...userExist, imageUrl: userExist.imageRef?.url || userExist.image };
    res.status(200).json(withUrl);
  } catch (error) {
    console.log(req.params.id);
    res.status(500).json({ error: error });
  }
};
// ✅ Update condition
export const updateCondition = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.files && Array.isArray(req.files) ? req.files.find((f) => f.fieldname === "image") : req.file;
    let { name, image: imageId, description, tags, exampleProductImages } = req.body || {};
    if (typeof tags === "string") {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = [];
      }
    }
    if (typeof exampleProductImages === "string") {
      try {
        exampleProductImages = JSON.parse(exampleProductImages);
      } catch {
        exampleProductImages = [];
      }
    }
    if (!Array.isArray(tags)) tags = [];
    if (!Array.isArray(exampleProductImages)) exampleProductImages = [];
    if (typeof imageId === "string") imageId = imageId.trim();
    if (Array.isArray(imageId)) imageId = imageId[0];
    const newImageUrl = file ? await uploadToBlob(file, "conditions") : null;

    const existingCondition = await Condition.findOne({
      name: name?.trim(),
      _id: { $ne: id },
    });
    if (existingCondition) {
      return res.json({
        success: false,
        message: "This Condition already exists!",
      });
    }

    const condition = await Condition.findById(id);
    if (!condition) {
      return res.json({
        success: false,
        message: "Condition not found!",
      });
    }

    if (newImageUrl && condition.image) {
      await deleteFromBlobIfUrl(condition.image);
    }

    condition.name = name?.trim();
    if (description !== undefined) condition.description = description || null;
    if (tags !== undefined) condition.tags = tags;
    if (exampleProductImages !== undefined) condition.exampleProductImages = exampleProductImages;
    if (imageId !== undefined) {
      condition.imageRef = imageId && mongoose.Types.ObjectId.isValid(imageId) ? imageId : null;
      if (condition.imageRef && !newImageUrl) {
        condition.image = null;
      }
    }
    if (newImageUrl) {
      condition.image = newImageUrl;
      condition.imageRef = null;
    }
    await condition.save();

    const populated = await Condition.findById(condition._id).populate("imageRef").lean();
    const withUrl = populated
      ? { ...populated, imageUrl: populated.imageRef?.url || populated.image }
      : condition;
    res.status(200).json({
      success: true,
      message: "Condition updated successfully",
      condition: withUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update Condition",
      error: error.message,
    });
  }
};
// ✅ Delete condition (with optional cascade: unlink from products)
export const deleteCondition = async (req, res) => {
  try {
    const { id } = req.params;
    const cascade = req.query.cascade === "true";
    const condition = await Condition.findById(id);

    if (!condition) {
      return res.status(404).json({
        success: false,
        message: "Condition not found",
      });
    }

    if (cascade) {
      const products = await Product.find({ condition: id });
      for (const product of products) {
        if (Array.isArray(product.images)) {
          for (const img of product.images) {
            if (img) await deleteFromBlobIfUrl(img);
          }
        }
        if (product.image) await deleteFromBlobIfUrl(product.image);
        await Product.findByIdAndDelete(product._id);
      }
    } else {
      const productCount = await Product.countDocuments({ condition: id });
      if (productCount > 0) {
        return res.status(409).json({
          success: false,
          message: "Condition has linked products. Use cascade or transfer.",
          productsCount: productCount,
        });
      }
    }

    if (condition.image) {
      await deleteFromBlobIfUrl(condition.image);
    }

    await Condition.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Condition deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete condition",
      error: error.message,
    });
  }
};

// ========== Bulk dependency & delete ==========

/**
 * POST /conditions/check-bulk-dependencies
 * Body: { conditionIds: string[] }
 * Returns: { operationId, summary: { total, noDeps, needsResolution }, items: [...] }
 */
export const checkBulkDependencies = async (req, res) => {
  try {
    const { conditionIds } = req.body;
    const result = await checkBulkDependenciesService(conditionIds);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status =
      error.message?.includes("not found") || error.message?.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Failed to check bulk dependencies",
      error: error.message,
    });
  }
};

/**
 * POST /conditions/bulk-delete-preview
 * Body: { conditionIds: string[], resolutionPlan: { id, action, transferTo? }[] }
 * Returns: { summary, conditions } (simulation, no commit)
 */
export const bulkDeletePreview = async (req, res) => {
  try {
    const { conditionIds, resolutionPlan } = req.body;
    const result = await bulkDeletePreviewService(conditionIds, resolutionPlan);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status =
      error.message?.includes("not found") || error.message?.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Bulk delete preview failed",
      error: error.message,
    });
  }
};

/**
 * POST /conditions/bulk-delete
 * Body: { conditionIds: string[], resolutionPlan: { id, action, transferTo? }[] }
 */
export const bulkDelete = async (req, res) => {
  try {
    const { conditionIds, resolutionPlan } = req.body;
    const result = await executeBulkDeleteService(conditionIds, resolutionPlan);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status =
      error.message?.includes("not found") ||
      error.message?.includes("Invalid") ||
      error.message?.includes("cannot be in the delete list")
        ? 400
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Bulk delete failed",
      error: error.message,
    });
  }
};

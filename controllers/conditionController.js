// controllers/conditionController.js
import mongoose from "mongoose";
import Condition from "../models/conditionModel.js";
import Product from "../models/productModel.js";
import { uploadToBlob, deleteFromBlobIfUrl } from "../utils/blob.js";

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
    const { name } = req.body;

    const image = req.file
      ? await uploadToBlob(req.file, "conditions")
      : null;
    // Check if Condition already exists
    const existingCondition = await Condition.findOne({ name: name.trim() });

    if (existingCondition) {
      return res.json({
        success: false,
        message: "This Condition already exists!",
      });
    }
    // Create new Condition
    const newCondition = new Condition({ name: name.trim(), image });
    await newCondition.save();
    res.json({
      success: true,
      message: "Condition created successfully",
      Condition: newCondition,
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
        $lookup: {
          from: "products", // products collection ka naam
          localField: "_id",
          foreignField: "condition",
          as: "products",
        },
      },
      {
        $addFields: {
          productCount: { $size: "$products" },
        },
      },
      {
        $project: {
          products: 0,
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
      message: "Failed to retrieve brands",
      error: error.message,
    });
  }
};
// ✅ Get single condition by ID
export const getConditionById = async (req, res) => {
  try {
    const id = req.params.id;
    const userExist = await Condition.findById(id);
    if (!userExist) {
      return res.status(404).json({ msg: "Condition not found" });
    }
    res.status(200).json(userExist);
  } catch (error) {
    console.log(req.params.id);
    res.status(500).json({ error: error });
  }
};
// ✅ Update condition
export const updateCondition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const newImage = req.file
      ? await uploadToBlob(req.file, "conditions")
      : null;

    // 🔎 Check if another condition with same name exists
    const existingCondition = await Condition.findOne({
      name: name.trim(),
      _id: { $ne: id }, // exclude current condition from check
    });
    if (existingCondition) {
      return res.json({
        success: false,
        message: "This Condition already exists!",
      });
    }

    // 🔎 Find condition before update
    const condition = await Condition.findById(id);
    if (!condition) {
      return res.json({
        success: false,
        message: "Condition not found!",
      });
    }

    // ✅ Agar new image upload hui hai to purani Blob image delete karo
    if (newImage && condition.image) {
      await deleteFromBlobIfUrl(condition.image);
    }

    // ✅ Update condition fields
    condition.name = name.trim();
    if (newImage) condition.image = newImage;

    await condition.save();

    res.status(200).json({
      success: true,
      message: "Condition updated successfully",
      condition,
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

// controllers/conditionController.js
import Condition from "../models/conditionModel.js";
import fs from "fs/promises";
import path from "path";

const __dirname = path.resolve(); // current project root

// ✅ Create condition
export const createCondition = async (req, res) => {
  try {
    const { name } = req.body;

    const image = req.file ? `/uploads/conditions/${req.file.filename}` : null;
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
          foreignField: "conditions", // <-- yaha plural rakho
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
      ? `/uploads/conditions/${req.file.filename}`
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

    // ✅ Agar new image upload hui hai to purani image delete karo
    if (newImage && condition.image) {
      const oldImagePath = path.join(process.cwd(), condition.image);
      try {
        await fs.unlink(oldImagePath); // async delete
      } catch (err) {
        console.warn("⚠️ Old condition image delete failed:", err.message);
      }
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
// ✅ Delete condition
export const deleteCondition = async (req, res) => {
  try {
    const { id } = req.params;
    const condition = await Condition.findById(id);

    if (!condition) {
      return res.status(404).json({
        success: false,
        message: "Condition not found",
      });
    }

    // ✅ Agar condition ki image hai to delete karo
    if (condition.image) {
      const imagePath = path.join(process.cwd(), condition.image); // condition.image = "/uploads/conditions/xyz.jpg"
      try {
        await fs.unlink(imagePath); // async delete
      } catch (err) {
        console.warn("⚠️ Old condition image delete failed:", err.message);
      }
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

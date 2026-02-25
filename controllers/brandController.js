// controllers/brandController.js
import Brand from "../models/brandModel.js";
import { uploadToBlob, deleteFromBlobIfUrl } from "../utils/blob.js";

export const createBrand = async (req, res) => {
  try {
    const { name } = req.body;

    const image = req.file ? await uploadToBlob(req.file, "brands") : null;

    const existingBrand = await Brand.findOne({ name: name.trim() });
    if (existingBrand) {
      return res.json({
        success: false,
        message: "This Brand already exists!",
      });
    }

    const newBrand = new Brand({
      name: name.trim(),
      image,
    });
    await newBrand.save();

    res.json({
      success: true,
      message: "Brand created successfully",
      Brand: newBrand,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create Brand",
      error: error.message,
    });
  }
};

// New function for bulk brand creation
export const createBulkBrands = async (req, res) => {
  try {
    const brandsData = req.body; // An array of brand objects from the Excel file

    const createdBrands = [];
    for (const brandData of brandsData) {
      const { name, image } = brandData;

      const existingBrand = await Brand.findOne({ name: name.trim() });
      if (existingBrand) {
        // console.log(`Brand already exists, skipping: ${name}`);
        continue; // Skip to the next item
      }

      const newBrand = new Brand({
        name: name.trim(),
        image, // The image path is directly available here
      });
      await newBrand.save();
      createdBrands.push(newBrand);
    }

    res.json({
      success: true,
      message: `${createdBrands.length} brands created successfully`,
      brands: createdBrands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create brands in bulk",
      error: error.message,
    });
  }
};
// ✅ Get all brands
export const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find();
    res.status(200).json({
      success: true,
      brands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
      error: error.message,
    });
  }
};
// ✅ Get all brands with product count
export const getBrandsCount = async (req, res) => {
  try {
    const brands = await Brand.aggregate([
      {
        $lookup: {
          from: "products", // products collection ka naam
          localField: "_id",
          foreignField: "brands", // <-- yaha plural rakho
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
      {
        $sort: { name: 1 }, // 🔹 Ascending A→Z
      },
    ]);

    res.status(200).json({
      success: true,
      brands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve brands",
      error: error.message,
    });
  }
};
// ✅ Get brand by ID
export const getBrandById = async (req, res) => {
  try {
    const id = req.params.id;
    const userExist = await Brand.findById(id);
    if (!userExist) {
      return res.status(404).json({ msg: "Brand not found" });
    }
    res.status(200).json(userExist);
  } catch (error) {
    console.log(req.params.id);
    res.status(500).json({ error: error });
  }
};
// ✅ Update brand by ID
export const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const newImage = req.file ? await uploadToBlob(req.file, "brands") : null;

    // 🔎 Check duplicate name (excluding same id)
    const duplicate = await Brand.findOne({
      name: name.trim(),
      _id: { $ne: id },
    });
    if (duplicate) {
      return res.json({
        success: false,
        message: "This Brand already exists!",
      });
    }

    // 🔎 Find brand before update
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.json({
        success: false,
        message: "Brand not found!",
      });
    }

    // ✅ Agar new image upload hui hai to purani Blob image delete karo (async)
    if (newImage && brand.image) {
      await deleteFromBlobIfUrl(brand.image);
    }

    // ✅ Update brand
    brand.name = name.trim();
    if (newImage) brand.image = newImage;

    await brand.save();

    res.json({
      success: true,
      message: "Brand updated successfully",
      brand,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update Brand",
      error: error.message,
    });
  }
};
// ✅ Delete brand by ID
export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    // ✅ Agar brand ki image hai to Blob se delete karo (sirf URL hone par)
    if (brand.image) {
      await deleteFromBlobIfUrl(brand.image);
    }

    await Brand.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete brand",
      error: error.message,
    });
  }
};

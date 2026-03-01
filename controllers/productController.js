import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Subcategory from "../models/subcategoryModel.js";
import Brand from "../models/brandModel.js";
import Condition from "../models/conditionModel.js";
import Sale from "../models/saleModel.js";
import QRCode from "qrcode";
import xlsx from "xlsx";
import { uploadToBlob, deleteFromBlobIfUrl } from "../utils/blob.js";

// ✅ Upload product image only (returns URL for use in bulk import etc.)
export const uploadProductImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }
    const imageUrl = await uploadToBlob(req.file, "products");
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

// ✅ Delete product image from blob by URL (for import: replace image from device)
export const deleteProductImageByUrl = async (req, res) => {
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

// Create Product
export const createProduct = async (req, res) => {
  try {
    const {
      title,
      sku,
      asin,
      purchasePrice,
      salePrice,
      quantity,
      description,
      modelno,
      category,
      subcategory,
      brand,
      condition,
      returnable,
    } = req.body;

    // 🔍 ASIN check
    // const asinExists = await Product.findOne({ asin });
    // if (asinExists) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "❌ ASIN already exists",
    //   });
    // }
    // 🔍 SKU check
    const skuExists = await Product.findOne({ sku });
    if (skuExists) {
      return res.status(400).json({
        success: false,
        message: "❌ SKU already exists",
      });
    }

    // 🔍 ModelNo check
    // const modelExists = await Product.findOne({ modelno });
    // if (modelExists) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "❌ Model Number already exists",
    //   });
    // }

    // ✅ SKU se QR generate karna
    const qrCode = await QRCode.toDataURL(sku);

    // ✅ Multiple images support (images[] or image)
    let uploadedImages = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      const imageFiles = req.files.filter(
        (file) => file.fieldname === "images" || file.fieldname === "image"
      );
      if (imageFiles.length > 0) {
        uploadedImages = await Promise.all(
          imageFiles.map((file) => uploadToBlob(file, "products"))
        );
      }
    } else if (req.file) {
      const singleImage = await uploadToBlob(req.file, "products");
      if (singleImage) {
        uploadedImages = [singleImage];
      }
    }

    const image = uploadedImages[0] || null;

    const product = new Product({
      title,
      sku,
      asin,
      purchasePrice,
      salePrice,
      quantity,
      description,
      modelno,
      category: category || null,
      subcategory: subcategory || null,
      brand,
      condition,
      returnable: returnable ?? true,
      qrCode,
      image,
      images: uploadedImages,
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully ✅",
      product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkCreateProducts = async (req, res) => {
  try {
    const products = req.body; // Array of products [{title, sku, ...}, ...]

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No products provided",
      });
    }

    // 🔹 Fetch all categories, subcategories, brands, conditions once for efficiency
    const [categoriesList, subcategoriesList, brandsList, conditionsList] = await Promise.all([
      Category.find().select("name _id").lean(),
      Subcategory.find().select("name _id category").lean(),
      Brand.find().select("name _id").lean(),
      Condition.find().select("name _id").lean(),
    ]);

    const newProducts = [];

    for (const item of products) {
      // 🔍 Duplicate check: use SKU only (generated from ASIN+Condition on frontend)
      const existingProduct = await Product.findOne({ sku: item.sku });
      if (existingProduct) {
        continue;
      }

      // 🔹 Resolve id from value: accept MongoDB ObjectId (24 hex) or name
      const resolveId = (list, value) => {
        if (!value) return null;
        const str = Array.isArray(value) ? value[0] : String(value).split(",")[0].trim();
        if (!str) return null;
        if (/^[a-fA-F0-9]{24}$/.test(str)) {
          const byId = list.find((x) => String(x._id) === str);
          return byId ? byId._id : null;
        }
        const byName = list.find((x) => (x.name || "").trim() === str);
        return byName ? byName._id : null;
      };

      // 🔹 Category (accept category/categories/Categories from payload)
      const categoryRaw = item.category ?? item.categories ?? item.Categories;
      let categoryId = resolveId(categoriesList, categoryRaw);

      // 🔹 Subcategory
      const subcategoryRaw = item.subcategory ?? item.subcategories ?? item.Subcategories;
      let subcategoryId = resolveId(subcategoriesList, subcategoryRaw);

      // 🔹 Brand
      const brandRaw = item.brand ?? item.brands ?? item.Brands;
      let brandId = resolveId(brandsList, brandRaw);

      // 🔹 Condition
      const conditionRaw = item.condition ?? item.conditions ?? item.Conditions;
      let conditionId = resolveId(conditionsList, conditionRaw);

      // 🔹 QR Code generate karein
      const qrCode = await QRCode.toDataURL(item.sku);

      if (!brandId || !conditionId) continue;

      newProducts.push({
        title: item.title,
        sku: item.sku,
        asin: item.asin || null,
        purchasePrice: item.purchasePrice,
        salePrice: item.salePrice,
        quantity: item.quantity || 0,
        description: item.description,
        modelno: item.modelno,
        category: categoryId,
        subcategory: subcategoryId,
        brand: brandId,
        condition: conditionId,
        qrCode,
        image: item.image || null,
        images: item.image ? [item.image] : [],
      });
    }

    if (newProducts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No new products to insert (maybe duplicates)",
      });
    }

    await Product.insertMany(newProducts);

    res.status(201).json({
      success: true,
      message: `${newProducts.length} products imported successfully ✅`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to import products",
      error: error.message,
    });
  }
};
//// Bulk Import Products from Excel  //
// Bulk Import Products from Excel
export const bulkImportProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // ✅ Excel file parse karo (memory buffer se, disk nahi)
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    let importedItems = [];

    for (let row of rows) {
      const { title, asin, orderedQty, purchasePrice } = row;

      if (!asin || !title || !purchasePrice || !orderedQty) {
        continue; // required fields skip karo agar missing hai
      }

      // ✅ Quantity ke hisaab se multiple PO rows banao
      for (let i = 0; i < orderedQty; i++) {
        importedItems.push({
          title,
          asin,
          orderedQty: 1,
          purchasePrice,
          total: purchasePrice * 1,
          status: "pending",
        });
      }
    }

    // ✅ Response
    res.json({
      success: true,
      message: "PO file imported successfully. Products not yet created.",
      items: importedItems, // frontend table display ke liye
    });
  } catch (err) {
    console.error("Bulk import error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get All Products
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("brand")
      .populate("condition")
      .populate("category")
      .populate("subcategory");

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Product
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("brand")
      .populate("condition")
      .populate("category")
      .populate("subcategory");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      sku,
      asin,
      purchasePrice,
      salePrice,
      quantity,
      description,
      modelno,
      category,
      subcategory,
      brand,
      condition,
    } = req.body;

    // 🔍 Duplicate check: SKU ya ModelNo already exist karta hai?
    const existingProduct = await Product.findOne({
      $or: [{ sku }],
      _id: { $ne: id }, // 👈 apne current product ko exclude karna
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "❌ SKUalready exists",
      });
    }

    // 🔍 Pehle current product fetch kar lein (purani image delete ke liye)
    const currentProduct = await Product.findById(id);
    if (!currentProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found ❌" });
    }

    // ✅ Agar new image(s) upload hui hain
    let uploadedImages;
    if (Array.isArray(req.files) && req.files.length > 0) {
      const imageFiles = req.files.filter(
        (file) => file.fieldname === "images" || file.fieldname === "image"
      );
      if (imageFiles.length > 0) {
        uploadedImages = await Promise.all(
          imageFiles.map((file) => uploadToBlob(file, "products"))
        );

        // Purani Blob images delete karo (sirf URL hone par)
        if (Array.isArray(currentProduct.images)) {
          for (const img of currentProduct.images) {
            if (img) {
              await deleteFromBlobIfUrl(img);
            }
          }
        }
        if (currentProduct.image && (!currentProduct.images || !currentProduct.images.length)) {
          await deleteFromBlobIfUrl(currentProduct.image);
        }
      }
    } else if (req.file) {
      const singleImage = await uploadToBlob(req.file, "products");
      if (singleImage) {
        uploadedImages = [singleImage];
      }

      // Purani Blob image delete karo (sirf URL hone par)
      if (currentProduct.image) {
        await deleteFromBlobIfUrl(currentProduct.image);
      }
    }

    // ✅ Agar SKU update hua hai to naya QR generate karein
    let qrCode;
    if (sku) {
      qrCode = await QRCode.toDataURL(sku);
    }

    const updateData = {
      title,
      sku,
      asin,
      purchasePrice,
      salePrice,
      quantity,
      description,
      modelno,
      category: category || null,
      subcategory: subcategory || null,
      brand,
      condition,
      ...(qrCode && { qrCode }),
    };

    if (uploadedImages && uploadedImages.length) {
      updateData.images = uploadedImages;
      updateData.image = uploadedImages[0];
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.status(200).json({
      success: true,
      message: "Product updated successfully ✅",
      product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get products by brand, category, condition, stock
export const getProductsByFilter = async (req, res) => {
  try {
    const { type, id } = req.params; // type = brand | category | condition | stock
    let filter = {};

    if (type === "brand") filter.brand = id;
    else if (type === "category") filter.category = id;
    else if (type === "condition") filter.condition = id;
    else if (type === "stock") {
      if (id === "in-stock") filter.quantity = { $gt: 0 };
      else if (id === "out-of-stock") filter.quantity = 0;
    }

    const products = await Product.find(filter)
      .populate("category", "name")
      .populate("subcategory")
      .populate("brand", "name")
      .populate("condition", "name");

    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ✅ Get products by stock status
export const getProductsByFilterStock = async (req, res) => {
  try {
    const { status } = req.params;
    let query = {};
    console.log(status);

    if (status === "in-stock") {
      query.quantity = { $gt: 0 };
    } else if (status === "out-of-stock") {
      query.quantity = 0;
    }

    const products = await Product.find(query).populate(
      "brand category subcategory condition"
    );

    res.json({ success: true, products });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching products" });
  }
};
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const usedInOrder = await Sale.findOne({ "items.product": id });
    if (usedInOrder) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete product because it is linked to one or more orders. Remove or edit those orders first.",
      });
    }

    // ✅ Agar product ki images hain to Blob se delete karo (sirf URL hone par)
    if (Array.isArray(product.images)) {
      for (const img of product.images) {
        if (img) {
          await deleteFromBlobIfUrl(img);
        }
      }
    }
    if (product.image) {
      await deleteFromBlobIfUrl(product.image);
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Brand from "../models/brandModel.js";
import Condition from "../models/conditionModel.js";
import QRCode from "qrcode";
import xlsx from "xlsx";
import { uploadToBlob, deleteFromBlobIfUrl } from "../utils/blob.js";

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
      categories,
      subcategories,
      brands,
      conditions,
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

    const image = req.file ? await uploadToBlob(req.file, "products") : null;

    const product = new Product({
      title,
      sku,
      asin,
      purchasePrice,
      salePrice,
      quantity,
      description,
      modelno,
      categories: categories || [],
      subcategories: subcategories || [],
      brands,
      conditions,
      returnable: returnable ?? true,
      qrCode,
      image,
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

    // 🔹 Fetch all categories, brands, conditions once for efficiency
    const [categoriesList, brandsList, conditionsList] = await Promise.all([
      Category.find().select("name _id").lean(),
      Brand.find().select("name _id").lean(),
      Condition.find().select("name _id").lean(),
    ]);

    const newProducts = [];

    for (const item of products) {
      // 🔍 SKU or ModelNo duplicates check karein
      const existingProduct = await Product.findOne({
        $or: [
          { sku: item.sku },
          { modelno: item.modelno },
          { asin: item.asin },
        ],
      });
      if (existingProduct) {
        // console.log(
        //   `Product with SKU ${item.sku} or Model No ${item.modelno} or ASIN ${item.asin} already exists, skipping.`
        // );
        continue;
      }

      // 🔹 Categories ko map karein
      let categoryIds = [];
      if (item.categories) {
        const names = Array.isArray(item.categories)
          ? item.categories
          : item.categories.split(",").map((c) => c.trim());
        categoryIds = categoriesList
          .filter((c) => names.includes(c.name))
          .map((c) => c._id);
      }

      // 🔹 Brands ko map karein
      let brandIds = [];
      if (item.brands) {
        const names = Array.isArray(item.brands)
          ? item.brands
          : item.brands.split(",").map((b) => b.trim());
        brandIds = brandsList
          .filter((b) => names.includes(b.name))
          .map((b) => b._id);
      }

      // 🔹 Conditions ko map karein
      let conditionIds = [];
      if (item.conditions) {
        const names = Array.isArray(item.conditions)
          ? item.conditions
          : item.conditions.split(",").map((c) => c.trim());
        conditionIds = conditionsList
          .filter((c) => names.includes(c.name))
          .map((c) => c._id);
      }

      // 🔹 QR Code generate karein
      const qrCode = await QRCode.toDataURL(item.sku);

      newProducts.push({
        title: item.title,
        sku: item.sku,
        asin: item.asin || null,
        purchasePrice: item.purchasePrice,
        salePrice: item.salePrice,
        quantity: item.quantity || 0,
        description: item.description,
        modelno: item.modelno,
        categories: categoryIds,
        brands: brandIds,
        conditions: conditionIds,
        qrCode,
        image: item.image || null,
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
      .populate("brands")
      .populate("conditions")
      .populate("categories")
      .populate("subcategories");

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
      .populate("brands")
      .populate("conditions")
      .populate("categories")
      .populate("subcategories");

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
      categories,
      subcategories,
      brands,
      conditions,
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

    // ✅ Agar new image upload hui hai
    let image;
    if (req.file) {
      image = await uploadToBlob(req.file, "products");

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
      categories: categories || [],
      subcategories: subcategories || [],
      brands,
      conditions,
      ...(qrCode && { qrCode }),
      ...(image && { image }),
    };

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

    if (type === "brand") filter.brands = id;
    else if (type === "category") filter.categories = id;
    else if (type === "condition") filter.conditions = id;
    else if (type === "stock") {
      if (id === "in-stock") filter.quantity = { $gt: 0 };
      else if (id === "out-of-stock") filter.quantity = 0;
    }

    const products = await Product.find(filter)
      .populate("categories", "name")
      .populate("subcategories")
      .populate("brands", "name")
      .populate("conditions", "name");

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
      "brands categories subcategories conditions"
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

    // ✅ Agar product ki image hai to Blob se delete karo (sirf URL hone par)
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

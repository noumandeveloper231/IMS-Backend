import multer from "multer";
import path from "path";

// In-memory storage for Vercel (no disk writes)
const storage = multer.memoryStorage();

// File filter (only images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"));
  }
};

const uploadProducts = multer({ storage, fileFilter });

export default uploadProducts;


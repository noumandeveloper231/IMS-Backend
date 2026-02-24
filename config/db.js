// config/db.js
import mongoose from "mongoose";

const connectDB = async (uri) => {
  try {
    await mongoose.connect(uri, {
      // options not required with mongoose 6+
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    // Serverless (Vercel): throw so handler returns 500; local: exit process
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
    process.exit(1);
  }
};

export default connectDB;

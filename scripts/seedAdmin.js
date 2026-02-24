import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/userModel.js";

dotenv.config();

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const exists = await User.findOne({ email: "admin@posims.com" });
    if (exists) {
      console.log("Admin user already exists");
      process.exit(0);
      return;
    }
    await User.create({
      name: "Admin",
      email: "admin@posims.com",
      password: "admin123",
      role: "admin",
    });
    console.log("✅ Admin user created: admin@posims.com / admin123");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedAdmin();

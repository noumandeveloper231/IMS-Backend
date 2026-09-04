import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/userModel.js";
import Role from "../models/roleModel.js";

dotenv.config();

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const adminRole = await Role.findOne({ name: "admin" });
    if (!adminRole) {
      console.error("Run scripts/seedRoles.js first to create roles.");
      process.exit(1);
    }
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
      role: adminRole._id,
    });
    console.log("✅ Admin user created: admin@posims.com / admin123");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedAdmin();

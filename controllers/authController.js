import User from "../models/userModel.js";
import Role from "../models/roleModel.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

/**
 * Generate JWT with id, role name, and permissions so protect() doesn't need DB.
 */
const generateToken = (id, roleName, permissions) => {
  return jwt.sign(
    { id, role: roleName, permissions: permissions || [] },
    process.env.JWT_SECRET || "pos-ims-secret",
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

function buildUserPayload(user, roleDoc) {
  const roleName = roleDoc ? roleDoc.name : (user.role && user.role.name);
  const permissions = roleDoc ? roleDoc.permissions : (user.role && user.role.permissions) || [];
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: roleName,
    permissions,
  };
}

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role: roleInput } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error("User already exists with this email");
      error.statusCode = 400;
      throw error;
    }
    let roleId = roleInput;
    if (roleInput && typeof roleInput === "string" && !mongoose.Types.ObjectId.isValid(roleInput)) {
      const roleDoc = await Role.findOne({ name: roleInput });
      if (!roleDoc) {
        const error = new Error(`Unknown role: ${roleInput}`);
        error.statusCode = 400;
        throw error;
      }
      roleId = roleDoc._id;
    }
    if (!roleId) {
      const salesmanRole = await Role.findOne({ name: "salesman" });
      if (!salesmanRole) {
        const error = new Error("Default role 'salesman' not found. Run scripts/seedRoles.js first.");
        error.statusCode = 500;
        throw error;
      }
      roleId = salesmanRole._id;
    }
    const user = await User.create({ name, email, password, role: roleId });
    const userWithRole = await User.findById(user._id).populate("role");
    const roleDoc = userWithRole.role;
    if (!roleDoc) {
      const error = new Error("User role not found");
      error.statusCode = 500;
      throw error;
    }
    const payload = buildUserPayload(user, roleDoc);
    const token = generateToken(user._id, payload.role, payload.permissions);
    res.status(201).json({
      success: true,
      token,
      user: payload,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password").populate("role");
    if (!user) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }
    if (user.status !== "active") {
      const error = new Error("Account is inactive");
      error.statusCode = 403;
      throw error;
    }
    const roleDoc = user.role;
    if (!roleDoc) {
      const error = new Error("User role not configured");
      error.statusCode = 403;
      throw error;
    }
    const payload = buildUserPayload(user, roleDoc);
    const token = generateToken(user._id, payload.role, payload.permissions);
    res.json({
      success: true,
      token,
      user: payload,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate("role");
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    const roleDoc = user.role;
    const payload = buildUserPayload(user, roleDoc);
    res.json({
      success: true,
      user: payload,
    });
  } catch (error) {
    next(error);
  }
};

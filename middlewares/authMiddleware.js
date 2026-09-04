import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { getEffectivePermissions } from "../constants/permissions.js";

/**
 * Protect: verify JWT and set req.user from token payload (id, role, permissions).
 * If token lacks permissions (legacy token), load user from DB and attach permissions from role.
 */
export const protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      const error = new Error("Not authorized to access this route");
      error.statusCode = 401;
      throw error;
    }
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "pos-ims-secret"
    );
    if (decoded.permissions && Array.isArray(decoded.permissions)) {
      req.user = {
        id: decoded.id,
        role: decoded.role,
        permissions: getEffectivePermissions(decoded.permissions),
      };
      return next();
    }
    const user = await User.findById(decoded.id).populate("role");
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 401;
      throw error;
    }
    if (user.status !== "active") {
      const error = new Error("Account is inactive");
      error.statusCode = 403;
      throw error;
    }
    const permissions = getEffectivePermissions(
      user.role && user.role.permissions ? user.role.permissions : []
    );
    req.user = {
      id: user._id,
      role: user.role ? user.role.name : null,
      permissions,
    };
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      error.message = "Invalid token";
      error.statusCode = 401;
    }
    if (error.name === "TokenExpiredError") {
      error.message = "Token expired";
      error.statusCode = 401;
    }
    next(error);
  }
};

/**
 * Allow: require one of the given permissions. Use after protect().
 */
export const allow = (...permissions) => {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.permissions)) {
      const error = new Error("Not allowed");
      error.statusCode = 403;
      return next(error);
    }
    const hasOne = permissions.some((p) => req.user.permissions.includes(p));
    if (!hasOne) {
      const error = new Error("Not allowed");
      error.statusCode = 403;
      return next(error);
    }
    next();
  };
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const error = new Error("Not authorized to access this resource");
      error.statusCode = 403;
      return next(error);
    }
    next();
  };
};

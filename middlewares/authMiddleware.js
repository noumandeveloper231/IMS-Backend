import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

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
    const user = await User.findById(decoded.id);
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
    req.user = user;
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

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      const error = new Error("Not authorized to access this resource");
      error.statusCode = 403;
      return next(error);
    }
    next();
  };
};

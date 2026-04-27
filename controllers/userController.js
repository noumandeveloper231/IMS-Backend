import User from "../models/userModel.js";
import { deleteFromBlobIfUrl, uploadToBlob } from "../utils/blob.js";

export const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (status === "active" || status === "inactive") {
      filter.status = status;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .populate("role")
        .populate("employee")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("role")
      .populate("employee")
      .lean();
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    const created = await User.findById(user._id)
      .select("-password")
      .populate("role")
      .populate("employee")
      .lean();
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      const err = new Error("A user with this email already exists");
      err.statusCode = 400;
      return next(err);
    }
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { password, ...rest } = req.body;
    const doc = await User.findById(req.params.id);
    if (!doc) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    Object.keys(rest).forEach((key) => {
      if (rest[key] !== undefined) doc[key] = rest[key];
    });
    if (typeof password === "string" && password.trim()) {
      doc.password = password.trim();
    }
    await doc.save();
    const user = await User.findById(doc._id)
      .select("-password")
      .populate("role")
      .populate("employee")
      .lean();
    res.json(user);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      const err = new Error("A user with this email already exists");
      err.statusCode = 400;
      return next(err);
    }
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (status !== "active" && status !== "inactive") {
      const error = new Error("Status must be active or inactive");
      error.statusCode = 400;
      throw error;
    }
    if (req.user.id.toString() === id && status === "inactive") {
      const error = new Error("You cannot deactivate your own account");
      error.statusCode = 400;
      throw error;
    }
    const user = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true },
    )
      .select("-password")
      .populate("role")
      .populate("employee")
      .lean();
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, email, profilePicture } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    // Update name field for backward compatibility
    if (firstName || lastName) {
      user.name = `${user.firstName} ${user.lastName}`.trim();
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("role")
      .populate("employee")
      .lean();

    res.json(updatedUser);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      const err = new Error("A user with this email already exists");
      err.statusCode = 400;
      return next(err);
    }
    next(error);
  }
};

export const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error("No image file provided");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const imageUrl = await uploadToBlob(req.file, "users");
    if (!imageUrl) {
      const error = new Error("Failed to upload profile image");
      error.statusCode = 500;
      throw error;
    }

    if (user.profilePicture && user.profilePicture !== imageUrl) {
      await deleteFromBlobIfUrl(user.profilePicture);
    }

    user.profilePicture = imageUrl;
    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("role")
      .populate("employee")
      .lean();

    res.json({
      message: "Profile image uploaded successfully",
      url: imageUrl,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      const error = new Error("Current password is incorrect");
      error.statusCode = 400;
      throw error;
    }

    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword || "")) {
      const error = new Error(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      );
      error.statusCode = 400;
      throw error;
    }

    const isSameAsCurrent = await user.comparePassword(newPassword);
    if (isSameAsCurrent) {
      const error = new Error("New password must be different from current password");
      error.statusCode = 400;
      throw error;
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};

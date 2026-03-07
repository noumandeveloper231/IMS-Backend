import User from "../models/userModel.js";

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
      { new: true, runValidators: true }
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

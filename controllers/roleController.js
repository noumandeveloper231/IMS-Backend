import Role from "../models/roleModel.js";
import { PERMISSIONS_LIST } from "../constants/permissions.js";

/**
 * List all available permissions (for role editor UI).
 */
export const getPermissions = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: PERMISSIONS_LIST,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all roles (for dropdowns and role management).
 */
export const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ name: 1 }).lean();
    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single role by ID.
 */
export const getRoleById = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id).lean();
    if (!role) {
      const error = new Error("Role not found");
      error.statusCode = 404;
      throw error;
    }
    res.json(role);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a custom role (name + permissions). isSystem will be false.
 */
export const createRole = async (req, res, next) => {
  try {
    const { name, permissions } = req.body;
    const trimmedName = (name || "").trim().replace(/\s+/g, "_").toLowerCase();
    if (!trimmedName) {
      const error = new Error("Role name is required");
      error.statusCode = 400;
      throw error;
    }
    const existing = await Role.findOne({ name: trimmedName });
    if (existing) {
      const error = new Error("A role with this name already exists");
      error.statusCode = 400;
      throw error;
    }
    const permissionsArr = Array.isArray(permissions)
      ? permissions.filter((p) => typeof p === "string" && p)
      : [];
    const role = await Role.create({
      name: trimmedName,
      permissions: permissionsArr,
      isSystem: false,
    });
    res.status(201).json({
      success: true,
      data: role,
      message: "Role created successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a role (name and/or permissions). System roles can be updated too.
 */
export const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;
    const role = await Role.findById(id);
    if (!role) {
      const error = new Error("Role not found");
      error.statusCode = 404;
      throw error;
    }
    if (name !== undefined) {
      const trimmedName = (name || "").trim().replace(/\s+/g, "_").toLowerCase();
      if (!trimmedName) {
        const error = new Error("Role name cannot be empty");
        error.statusCode = 400;
        throw error;
      }
      const existing = await Role.findOne({ name: trimmedName, _id: { $ne: id } });
      if (existing) {
        const error = new Error("A role with this name already exists");
        error.statusCode = 400;
        throw error;
      }
      role.name = trimmedName;
    }
    if (permissions !== undefined) {
      role.permissions = Array.isArray(permissions)
        ? permissions.filter((p) => typeof p === "string" && p)
        : [];
    }
    await role.save();
    res.json({
      success: true,
      data: role,
      message: "Role updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a role. Only custom (non-system) roles can be deleted.
 */
export const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      const error = new Error("Role not found");
      error.statusCode = 404;
      throw error;
    }
    if (role.isSystem) {
      const error = new Error("System roles cannot be deleted");
      error.statusCode = 400;
      throw error;
    }
    await Role.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

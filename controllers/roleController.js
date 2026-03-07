import Role from "../models/roleModel.js";

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

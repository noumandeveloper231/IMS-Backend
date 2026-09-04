import { validationResult } from "express-validator";

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const extractedErrors = errors.array().map((err) => ({
    field: err.path,
    message: err.msg,
  }));
  const error = new Error(extractedErrors[0]?.message || "Validation failed");
  error.statusCode = 400;
  error.errors = extractedErrors;
  next(error);
};

import validate from "./validate";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@ecommerce/schemas";

// Ekspor validator spesifik untuk digunakan di rute
export const validateLogin = validate(loginSchema);
export const validateRegister = validate(registerSchema);
export const validateUpdateProfile = validate(updateProfileSchema);

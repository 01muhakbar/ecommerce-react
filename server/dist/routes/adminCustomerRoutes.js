import { Router } from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { getCustomers, exportCustomersCsv, importCustomersCsv, getCustomerById, updateCustomer, deleteCustomer, } from "../controllers/adminCustomerController.js";
const router = Router();
// Protect all routes in this file
router.use(protect, restrictTo("Super Admin", "Admin"));
router.get("/", getCustomers);
router.get("/export", exportCustomersCsv);
router.post("/import", importCustomersCsv); // TODO: Tambahkan middleware multer di sini jika diperlukan
router.get("/:id", getCustomerById);
router.patch("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);
export default router;

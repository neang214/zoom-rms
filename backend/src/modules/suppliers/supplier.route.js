import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as supplierController from "./supplier.controller.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("admin"),
  supplierController.getAllSuppliers,
);

router.get(
  "/archived",
  authenticate,
  authorize("admin"),
  supplierController.getArchivedSuppliers,
);

router.get(
  "/:id",
  authenticate,
  authorize("admin"),
  supplierController.getSupplier,
);

router.post(
  "/",
  authenticate,
  authorize("admin"),
  supplierController.createSupplier,
);

router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  supplierController.updateSupplier,
);

router.patch(
  "/:id/restore",
  authenticate,
  authorize("admin"),
  supplierController.restoreSupplier,
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  supplierController.deleteSupplier,
);

export default router;

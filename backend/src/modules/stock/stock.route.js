import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as stockController from "./stock.controller.js";
import { upload, setUploadPrefix } from "../../middleware/upload.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "kitchen", "barista"),
  stockController.getAllStockItems,
);
router.get(
  "/low",
  authenticate,
  authorize("admin"),
  stockController.getLowStock,
);
router.get(
  "/:id",
  authenticate,
  authorize("admin", "kitchen", "barista"),
  stockController.getStockById,
);
router.post(
  "/",
  authenticate,
  authorize("admin"),
  stockController.createStock,
);
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  stockController.updateStock,
);
router.patch(
  "/:id/increase",
  authenticate,
  authorize("admin"),
  stockController.addStockQuantity,
);
router.patch(
  "/:id/decrease",
  authenticate,
  authorize("kitchen", "barista", "admin"),
  stockController.decreaseStockQuantity,
);

router.post(
  "/:id/image",
  authenticate,
  authorize("admin"),
  setUploadPrefix("stock"),
  upload.single("image"),
  stockController.uploadStockImage,
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  stockController.deleteStock,
);

export default router;

import express from "express";
import { authorize } from "../../middleware/authorize.js";
import { authenticate } from "../../middleware/authenticate.js";
import { guestOrderLimiter } from "../../middleware/rateLimiter.js";
import * as tableController from "./table.controller.js";

const router = express.Router();

router.get("/", tableController.getAllTables);
router.get(
    "/admin/all",
    authenticate,
    authorize("admin"),
    tableController.getAllTablesAdmin,
);
router.get(
    "/admin/archived",
    authenticate,
    authorize("admin"),
    tableController.getArchivedTables,
);
router.get("/qr/:token", guestOrderLimiter, tableController.getTableByToken);
router.get("/:id", tableController.getTable);

router.post("/", authenticate, authorize("admin"), tableController.createTable);
router.put(
    "/:id",
    authenticate,
    authorize("admin"),
    tableController.updateTable,
);
router.patch(
    "/:id/toggle",
    authenticate,
    authorize("cashier"),
    tableController.updateTableStatus,
);

router.patch(
    "/:id/regenerate-qr",
    authenticate,
    authorize("admin"),
    tableController.regenerateQrToken,
);

router.patch(
    "/:id/restore",
    authenticate,
    authorize("admin"),
    tableController.restoreTable,
);

router.delete(
    "/:id",
    authenticate,
    authorize("admin"),
    tableController.deleteTable,
);

export default router;

import express from "express";
import * as cmsController from "../controllers/cmsController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.get("/", cmsController.getCmsContent);
// requirePermission("ManageProducts") also lets Owner/Admin through (its own built-in bypass),
// so this still covers CMS editing while also covering product-image and POS QR-code uploads
// that used to go straight from the browser to storage with no file-type check at all.
router.post("/upload-image", requireAuth, requirePermission("ManageProducts"), cmsController.uploadCmsImage);
router.get("/:section_key", cmsController.getCmsSection);
router.put("/:section_key", requireAuth, requireRole("Admin", "Owner"), cmsController.updateCmsContent);

export default router;

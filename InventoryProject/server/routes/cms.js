import express from "express";
import * as cmsController from "../controllers/cmsController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", cmsController.getCmsContent);
router.get("/:section_key", cmsController.getCmsSection);
router.put("/:section_key", requireAuth, requireRole("Admin", "Owner"), cmsController.updateCmsContent);

export default router;

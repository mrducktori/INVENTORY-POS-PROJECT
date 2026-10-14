import express from "express";
import * as cmsController from "../controllers/cmsController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", cmsController.getCmsContent);
router.put("/:section_key", requireAuth, cmsController.updateCmsContent);

export default router;

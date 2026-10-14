import * as cmsService from "../services/cmsService.js";
import { logAudit } from "../utils/auditHelper.js";

export const getCmsContent = async (req, res) => {
  try {
    const data = await cmsService.getCmsContent();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateCmsContent = async (req, res) => {
  try {
    const { section_key } = req.params;
    const { user_id, ...updates } = req.body;
    
    const data = await cmsService.updateCmsContent(section_key, updates);
    
    // Log audit
    await logAudit('CMS_CONTENT_UPDATED', user_id || null, { section_key });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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

export const getCmsSection = async (req, res) => {
  try {
    const { section_key } = req.params;
    if (!/^[a-z0-9_]{2,50}$/.test(section_key)) {
      return res.status(400).json({ error: "Invalid section key format" });
    }

    const data = await cmsService.getCmsSection(section_key);
    if (!data) {
      return res.status(404).json({ error: "Section not found" });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateCmsContent = async (req, res) => {
  try {
    const { section_key } = req.params;
    if (!/^[a-z0-9_]{2,50}$/.test(section_key)) {
      return res.status(400).json({ error: "Invalid section key format" });
    }

    const updates = req.body || {};

    // Validate image URL protocol if provided to prevent XSS (e.g. javascript: URLs)
    if (updates.image_url && typeof updates.image_url === 'string') {
      const trimmed = updates.image_url.trim();
      if (trimmed && !trimmed.startsWith('https://') && !trimmed.startsWith('http://') && !trimmed.startsWith('/')) {
        return res.status(400).json({ error: "Invalid image URL. Must be an HTTP/HTTPS URL." });
      }
    }

    const data = await cmsService.updateCmsContent(section_key, updates);
    
    // Log audit using authenticated user id per Rule 9
    const userId = req.user?.id || null;
    await logAudit('CMS_CONTENT_UPDATED', userId, { section_key, updated_by: req.user?.name });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const uploadCmsImage = async (req, res) => {
  try {
    const { fileName, mimeType, base64Data } = req.body || {};
    const resolvedFileName = fileName || 'image.png';
    const resolvedMimeType = mimeType || 'image/png';

    cmsService.validateCmsImageUpload({
      fileName: resolvedFileName,
      mimeType: resolvedMimeType,
      base64Data
    });

    const publicUrl = await cmsService.uploadCmsImageToStorage({
      fileName: resolvedFileName,
      mimeType: resolvedMimeType,
      base64Data
    });

    const userId = req.user?.id || null;
    await logAudit('CMS_IMAGE_UPLOADED', userId, {
      file_name: resolvedFileName,
      public_url: publicUrl,
      uploaded_by: req.user?.name
    });

    res.json({ publicUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to upload image." });
  }
};

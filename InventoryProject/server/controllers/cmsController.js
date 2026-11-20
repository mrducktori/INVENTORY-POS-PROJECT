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

const isSafeCmsImageUrl = (url) => {
  if (url === undefined || url === null) return true;
  if (typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return true;
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('//'))
  );
};

export const updateCmsContent = async (req, res) => {
  try {
    const { section_key } = req.params;
    if (!/^[a-z0-9_]{2,50}$/.test(section_key)) {
      return res.status(400).json({ error: "Invalid section key format" });
    }
    if (
      cmsService.INTERNAL_CMS_KEYS.has(section_key) ||
      !cmsService.ALLOWED_CMS_KEYS.has(section_key)
    ) {
      return res.status(400).json({ error: `Invalid or disallowed CMS section key: ${section_key}` });
    }

    const updates = req.body || {};

    // Validate image URL protocol if provided to prevent XSS (e.g. javascript: URLs)
    if (!isSafeCmsImageUrl(updates.image_url)) {
      return res.status(400).json({ error: "Invalid image URL. Must start with https://, http://, or /." });
    }

    if (section_key === 'promo_section' && updates.description !== undefined && updates.description !== null) {
      let slides = null;
      if (Array.isArray(updates.description)) {
        slides = updates.description;
      } else if (typeof updates.description === 'string') {
        const trimmedDesc = updates.description.trim();
        if (trimmedDesc.startsWith('[') || trimmedDesc.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmedDesc);
            if (Array.isArray(parsed)) {
              slides = parsed;
            } else if (parsed && typeof parsed === 'object') {
              slides = [parsed];
            }
          } catch {
            // Fallback for legacy plain text promo descriptions
          }
        }
      }

      if (slides) {
        for (const slide of slides) {
          if (slide && typeof slide === 'object' && !isSafeCmsImageUrl(slide.image_url)) {
            return res.status(400).json({ error: "Invalid promo slide image URL. Must start with https://, http://, or /." });
          }
        }
      }
    }

    const data = await cmsService.updateCmsContent(section_key, updates);
    
    // Log audit using authenticated user id per Rule 9
    const userId = req.user?.id || null;
    await logAudit('CMS_CONTENT_UPDATED', userId, { section_key, updated_by: req.user?.name });

    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
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

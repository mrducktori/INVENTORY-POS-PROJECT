import { supabase } from "../config/supabaseClient.js";

export const ALLOWED_CMS_KEYS = new Set([
  "browser_tab",
  "brand_logo",
  "landing_hero",
  "menu_section",
  "promo_section",
  "location_info",
  "social_links",
  "footer_info"
]);

export const INTERNAL_CMS_KEYS = new Set([
  "raw_material_categories",
  "inventory_batches_store",
  "ingredient_perishability_meta",
  "stocktake_history_store",
  "recipe_size_overrides_store",
  "pos_idempotency_store",
  "pos_shifts_store",
  "pos_voids_refunds_store",
  "pos_kds_queue_store",
  "manager_pins_store",
  "pos_sale_metadata_store",
  "category_prep_stations_map",
  "pos_store_settings"
]);

const isPublicCmsKey = (sectionKey) =>
  typeof sectionKey === "string" &&
  !INTERNAL_CMS_KEYS.has(sectionKey) &&
  ALLOWED_CMS_KEYS.has(sectionKey);

const CMS_CACHE_TTL_MS = 60 * 1000; // 1 minute server-side cache for public CMS reads
let cmsCache = null;
let cmsCacheAt = 0;
let cmsInFlight = null;

export const invalidateCmsCache = () => {
  cmsCache = null;
  cmsCacheAt = 0;
};

export const getCmsContent = async () => {
  const now = Date.now();
  if (cmsCache && now - cmsCacheAt < CMS_CACHE_TTL_MS) {
    return cmsCache;
  }
  if (cmsInFlight) {
    return cmsInFlight;
  }

  cmsInFlight = supabase
    .from("cms_content")
    .select("*")
    .then(({ data, error }) => {
      if (error) throw error;
      cmsCache = (data || []).filter((row) => row && isPublicCmsKey(row.section_key));
      cmsCacheAt = Date.now();
      return cmsCache;
    })
    .finally(() => {
      cmsInFlight = null;
    });

  return cmsInFlight;
};

export const getCmsSection = async (section_key) => {
  if (!isPublicCmsKey(section_key)) {
    return null;
  }
  if (cmsCache && Date.now() - cmsCacheAt < CMS_CACHE_TTL_MS) {
    return cmsCache.find((s) => s.section_key === section_key) || null;
  }
  const { data, error } = await supabase
    .from("cms_content")
    .select("*")
    .eq("section_key", section_key)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateCmsContent = async (section_key, updates = {}) => {
  if (!isPublicCmsKey(section_key)) {
    const err = new Error(`Invalid or disallowed CMS section key: ${section_key}`);
    err.status = 400;
    throw err;
  }

  const payload = { section_key };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.image_url !== undefined) payload.image_url = updates.image_url;

  const { data, error } = await supabase
    .from("cms_content")
    .upsert(payload)
    .select()
    .single();
    
  if (error) throw error;
  invalidateCmsCache();
  return data;
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon"
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "ico"]);

export const validateCmsImageUpload = ({ fileName, mimeType, base64Data }) => {
  if (!base64Data || typeof base64Data !== "string") {
    const err = new Error("Missing image data.");
    err.status = 400;
    throw err;
  }

  const trimmedData = base64Data.trim();
  if (trimmedData.startsWith("data:")) {
    const dataUriMatch = /^data:([^;,]+)(?:;[^,]*)?;base64,/i.exec(trimmedData);
    if (!dataUriMatch || !ALLOWED_IMAGE_MIME_TYPES.has(dataUriMatch[1].trim().toLowerCase())) {
      const err = new Error("Unsupported image MIME type. Only JPG, PNG, WEBP, GIF, or ICO images are allowed.");
      err.status = 400;
      throw err;
    }
  }

  const resolvedMime = String(mimeType || "image/png").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(resolvedMime)) {
    const err = new Error("Unsupported image MIME type. Only JPG, PNG, WEBP, GIF, or ICO images are allowed.");
    err.status = 400;
    throw err;
  }

  const rawName = String(fileName || "image.png").trim();
  const ext = rawName.includes(".") ? rawName.split(".").pop().toLowerCase() : "";
  if (!ext || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    const err = new Error("Unsupported image file extension. Only .jpg, .jpeg, .png, .webp, .gif, or .ico files are allowed.");
    err.status = 400;
    throw err;
  }

  const cleanedBase64 = trimmedData.replace(/^data:[^;]+;base64,/i, "");
  const buffer = Buffer.from(cleanedBase64, "base64");
  if (!buffer || buffer.length === 0) {
    const err = new Error("Invalid or empty image payload.");
    err.status = 400;
    throw err;
  }

  const headText = buffer.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  if (headText.startsWith("<svg") || headText.startsWith("<?xml") || headText.startsWith("<!doctype") || headText.startsWith("<html")) {
    const err = new Error("SVG and HTML/XML uploads are not allowed.");
    err.status = 400;
    throw err;
  }

  return { resolvedMime, buffer };
};

export const uploadCmsImageToStorage = async ({ fileName, mimeType, base64Data }) => {
  const { resolvedMime, buffer } = validateCmsImageUpload({ fileName, mimeType, base64Data });

  const safeName = String(fileName || 'upload.png')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  const storagePath = `cms_${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("cms-images")
    .upload(storagePath, buffer, {
      contentType: resolvedMime,
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Supabase storage upload failed.");
  }

  const { data } = supabase.storage.from("cms-images").getPublicUrl(storagePath);
  return data?.publicUrl || null;
};

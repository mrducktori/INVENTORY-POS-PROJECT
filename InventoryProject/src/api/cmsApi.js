import { apiCall } from "./client.js";

// In-memory cache to avoid duplicate network calls across components
let cmsCache = null;
let cacheTimestamp = 0;
let cmsInFlightPromise = null;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Validates that an image URL is safe to use in an img tag or CSS background
 * (protects against javascript:, vbscript:, or malformed protocols)
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  // Same-origin paths only: "//host" and "/\host" are protocol-relative
  if (trimmed.startsWith("/")) return !/^\/[/\\]/.test(trimmed);
  try {
    return ["http:", "https:"].includes(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}

/**
 * Returns raw array of CMS sections (backwards-compatible).
 */
export async function getCmsContent(forceRefresh = false) {
  const map = await getCmsMap(forceRefresh);
  return Object.values(map);
}

/**
 * Returns CMS content as a fast key-value dictionary: { [section_key]: record }.
 * Cached in memory so Navbar, LandingPage, and LoginPage don't fire 3 duplicate requests.
 */
export async function getCmsMap(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cmsCache && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cmsCache;
  }
  if (!forceRefresh && cmsInFlightPromise) {
    return cmsInFlightPromise;
  }

  cmsInFlightPromise = apiCall("/cms", { method: "GET" })
    .then((rawList) => {
      const map = {};
      if (Array.isArray(rawList)) {
        for (const item of rawList) {
          if (item && item.section_key) {
            map[item.section_key] = item;
          }
        }
      }
      cmsCache = map;
      cacheTimestamp = Date.now();
      return map;
    })
    .finally(() => {
      cmsInFlightPromise = null;
    });

  return cmsInFlightPromise;
}

/**
 * Fast helper to safely retrieve an image URL for any section key.
 * Validates the URL and falls back to fallbackUrl if empty or unsafe.
 */
export async function getCmsImage(sectionKey, fallbackUrl = "") {
  try {
    const map = await getCmsMap();
    const candidate = map[sectionKey]?.image_url;
    return isValidImageUrl(candidate) ? candidate : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

/**
 * Updates a section and immediately clears the cache so changes appear instantly.
 */
export async function updateCmsContent(section_key, updates) {
  const result = await apiCall(`/cms/${section_key}`, {
    method: "PUT",
    body: JSON.stringify(updates)
  });

  // Invalidate cache immediately on update
  cmsCache = null;
  cacheTimestamp = 0;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cms:updated", { detail: { section_key, data: result } }));
  }

  return result;
}

/**
 * Uploads an image file to the public 'cms-images' Supabase Storage bucket
 * via the authenticated backend endpoint and returns its public URL.
 */
export async function uploadCmsImage(file, prefix = "cms") {
  if (!file) return null;

  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safePrefix = String(prefix).replace(/[^a-z0-9_-]/gi, "_");
  const fileName = `${safePrefix}_${Date.now()}.${ext}`;

  const res = await apiCall("/cms/upload-image", {
    method: "POST",
    body: JSON.stringify({
      fileName,
      mimeType: file.type || "image/png",
      base64Data
    })
  });

  return res?.publicUrl || null;
}

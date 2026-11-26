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
const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024; // smaller files (QR codes, logos) are sent untouched
const MAX_IMAGE_DIMENSION = 1600;
// The server body limit is 10 MB of base64 (about 7.5 MB of image), so aim well under it.
const TARGET_BYTES = 1.2 * 1024 * 1024;

// Shrinks large JPG/PNG/WEBP photos (e.g. straight off a phone camera) to a JPEG that fits the
// upload limit. Other types, or already-small files, come back unchanged.
// shortcut: re-encodes as JPEG, so a large transparent PNG gets a white background.
async function compressImageIfLarge(file) {
  if (file.size <= COMPRESS_ABOVE_BYTES || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= TARGET_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
  } catch {
    // Browser can't decode it: fall through and let the server accept or reject the original.
  }
  return file;
}

export async function uploadCmsImage(originalFile, prefix = "cms") {
  if (!originalFile) return null;
  const file = await compressImageIfLarge(originalFile);

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

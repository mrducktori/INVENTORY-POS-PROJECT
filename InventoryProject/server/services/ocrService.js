import { supabase } from "../config/supabaseClient.js";
import { findSimilarName, normalizeName } from "../utils/stringHelper.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";
import { getManilaDateOnly } from "../utils/dateUtils.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const OCR_UNITS = new Set([
  "KG", "G", "L", "ML", "PCS", "PC", "BAG", "BAGS",
  "BOX", "BOXES", "PACK", "PACKS", "BOTTLE", "BOTTLES",
  "CAN", "CANS", "SACK", "SACKS", "UNIT", "UNITS"
]);
const UNIT_NORMALIZATION_MAP = {
  PC: "PCS",
  BAGS: "BAG",
  BOXES: "BOX",
  PACKS: "PACK",
  BOTTLES: "BOTTLE",
  CANS: "CAN",
  SACKS: "SACK",
  UNITS: "UNIT"
};

const MONTH_NAME_MAP = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

const createHttpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const pad2 = (n) => String(n).padStart(2, "0");

const isValidCalendarDate = (y, m, d) => {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const normalizeOcrDate = (rawDate) => {
  if (!rawDate) return null;
  const str = String(rawDate).trim();

  // YYYY-MM-DD or YYYY/MM/DD
  let m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return isValidCalendarDate(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
  }

  // MM/DD/YYYY or DD/MM/YYYY
  m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let p1 = Number(m[1]);
    let p2 = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (p1 > 12 && p2 <= 12) {
      [p1, p2] = [p2, p1];
    }
    return isValidCalendarDate(y, p1, p2) ? `${y}-${pad2(p1)}-${pad2(p2)}` : null;
  }

  // MMM DD, YYYY
  m = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = MONTH_NAME_MAP[m[1].toLowerCase()];
    const d = Number(m[2]);
    const y = Number(m[3]);
    return isValidCalendarDate(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
  }

  // DD MMM YYYY
  m = str.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = MONTH_NAME_MAP[m[2].toLowerCase()];
    const y = Number(m[3]);
    return isValidCalendarDate(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
  }

  return null;
};

const normalizeOcrUnit = (rawUnit) => {
  if (!rawUnit) return null;
  const upper = String(rawUnit).trim().toUpperCase();
  return UNIT_NORMALIZATION_MAP[upper] || upper;
};

const validateImageInput = (base64Image, mimeType) => {
  let cleanBase64 = String(base64Image || "").trim();
  let resolvedMime = mimeType ? String(mimeType).trim().toLowerCase() : "";

  const dataUriMatch = cleanBase64.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUriMatch) {
    resolvedMime = dataUriMatch[1].toLowerCase();
    cleanBase64 = dataUriMatch[2].trim();
  }

  if (resolvedMime && !ALLOWED_IMAGE_MIMES.has(resolvedMime)) {
    throw createHttpError(400, "Unsupported image type. Please upload PNG, JPG, or WEBP.");
  }

  if (!/^[A-Za-z0-9+/=\s]+$/.test(cleanBase64)) {
    throw createHttpError(400, "Invalid base64 image payload.");
  }

  const normalizedB64 = cleanBase64.replace(/\s+/g, "");
  const buffer = Buffer.from(normalizedB64, "base64");
  if (!buffer.length) {
    throw createHttpError(400, "Uploaded image is empty.");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw createHttpError(400, "Uploaded image exceeds the 8MB maximum limit.");
  }

  // Validate image header magic bytes
  const isPng = buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  if (!isPng && !isJpeg && !isWebp) {
    throw createHttpError(400, "Invalid image file signature. Only PNG, JPG, and WEBP images are supported.");
  }

  const detectedMime = isPng ? "image/png" : isJpeg ? "image/jpeg" : "image/webp";
  return {
    base64Data: normalizedB64,
    mimeType: resolvedMime === "image/jpg" ? "image/jpeg" : resolvedMime || detectedMime
  };
};

/**
 * Deterministic line-by-line receipt and expiry label parser (offline/fallback engine).
 */
const parseReceiptText = (rawText) => {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let supplier_name = null;
  let invoice_number = null;
  let invoice_date = null;
  const items = [];

  for (const line of lines) {
    const supMatch = line.match(/^(?:supplier|vendor|from|sold\s*by)\s*[:\-]\s*(.+)$/i);
    if (supMatch) {
      supplier_name = supMatch[1].trim().slice(0, 120);
      continue;
    }

    const invMatch = line.match(/^(?:invoice|inv|receipt|dr|po|ref)(?:\s*(?:#|no\.?))?\s*[:\-]\s*([A-Z0-9][A-Z0-9\-\/]{1,40})$/i);
    if (invMatch) {
      invoice_number = invMatch[1].trim();
      continue;
    }

    const dateHeaderMatch = line.match(/^(?:invoice\s*date|date|issued)\s*[:\-]\s*(.+)$/i);
    if (dateHeaderMatch) {
      invoice_date = normalizeOcrDate(dateHeaderMatch[1]) || invoice_date;
      continue;
    }

    // Skip totals/separator lines
    if (/^(?:total|subtotal|grand\s*total|tax|vat|discount|thank\s*you|[-=_*]{3,})/i.test(line)) {
      continue;
    }

    let work = line;
    let batch_code = null;
    let expiry_date = null;
    let unit_price = null;

    // 1. Extract Batch / Lot code
    const batchMatch = work.match(
      /(?:batch|lot)(?:\s*(?:no\.?|code|#))?\s*:\s*([A-Z0-9][A-Z0-9\-_]{1,59})|\b((?:LOT|BATCH)[-_][A-Z0-9\-_]{2,55})\b|(?:batch|lot)\s+(?:no\.?|code|#)\s*-?\s*([A-Z0-9][A-Z0-9\-_]{1,59})/i
    );
    if (batchMatch) {
      batch_code = (batchMatch[1] || batchMatch[2] || batchMatch[3] || "").trim().toUpperCase();
      work = work.replace(batchMatch[0], " ");
    }

    // 2. Extract Expiry date
    const expMatch = work.match(
      /(?:exp(?:iry)?(?:\s*date)?|best\s*before|bb|use\s*by)\s*[:\-]?\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4})/i
    );
    if (expMatch) {
      expiry_date = normalizeOcrDate(expMatch[1]);
      work = work.replace(expMatch[0], " ");
    }

    // 3. Extract Unit Price
    const priceMatch = work.match(/(?:@\s*(?:₱|PHP|P)?|(?:₱|PHP))\s*([\d,]+(?:\.\d+)?)/i);
    if (priceMatch) {
      unit_price = Number(priceMatch[1].replace(/,/g, ""));
      work = work.replace(priceMatch[0], " ");
    }

    // 4. Extract Quantity and Unit
    let quantity = null;
    let unit = null;

    const unitPattern = Array.from(OCR_UNITS).join("|");
    const leadingQtyUnit = work.match(
      new RegExp(`^(?:\\d+\\s*[.)]\\s*)?(\\d+(?:\\.\\d+)?)\\s*(?:x\\s*)?(${unitPattern})\\b`, "i")
    );
    const trailingQtyUnit = work.match(
      new RegExp(`(?:[-|x×:]|\\s)\\s*(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, "i")
    );
    const qtyOnlyMatch = work.match(/(?:[x×]|qty\s*[:\-])\s*(\d+(?:\.\d+)?)\b/i);

    if (leadingQtyUnit) {
      quantity = Number(leadingQtyUnit[1]);
      unit = normalizeOcrUnit(leadingQtyUnit[2]);
      work = work.replace(leadingQtyUnit[0], " ");
    } else if (trailingQtyUnit) {
      quantity = Number(trailingQtyUnit[1]);
      unit = normalizeOcrUnit(trailingQtyUnit[2]);
      work = work.replace(trailingQtyUnit[0], " ");
    } else if (qtyOnlyMatch) {
      quantity = Number(qtyOnlyMatch[1]);
      work = work.replace(qtyOnlyMatch[0], " ");
    }

    const raw_name = work
      .replace(/^[\d]+\s*[.)]\s*/, "")
      .replace(/[|•]/g, " ")
      .replace(/^[\s\-:,/]+|[\s\-:,/]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Handle follow-up metadata line (e.g. "EXP: 2026-12-30 LOT-001" after item line)
    if (!raw_name && quantity === null && (expiry_date || batch_code) && items.length > 0) {
      const prev = items[items.length - 1];
      if (expiry_date && !prev.expiry_date) prev.expiry_date = expiry_date;
      if (batch_code && !prev.batch_code) prev.batch_code = batch_code;
      continue;
    }

    if (raw_name && (quantity !== null || expiry_date !== null || batch_code !== null)) {
      items.push({
        raw_name,
        quantity: quantity ?? 1,
        unit,
        unit_price,
        expiry_date,
        batch_code
      });
    }
  }

  return {
    supplier_name,
    invoice_number,
    invoice_date,
    items
  };
};

const STOP_WORDS = new Set(["and", "with", "for", "the", "of", "in", "by", "pack", "bag", "box", "bottle"]);

const tokenizeName = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

const computeTokenOverlapScore = (rawName, ingName) => {
  const tokensA = tokenizeName(rawName);
  const tokensB = tokenizeName(ingName);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const shared = tokensA.filter((t) => setB.has(t)).length;
  if (shared === 0) return 0;

  const coverageA = shared / tokensA.length;
  const coverageB = shared / tokensB.length;
  const jaccard = shared / new Set([...tokensA, ...tokensB]).size;
  return Math.max(jaccard, (coverageA + coverageB) / 2);
};

/**
 * Matches extracted items against active ingredients and enforces bounds/date warnings.
 */
const matchExtractedItemsToIngredients = (extractedItems = [], ingredients = []) => {
  const todayManila = getManilaDateOnly();
  const warnings = [];
  const activeIngredients = (ingredients || []).filter((i) => !i.is_archived);
  const ingNames = activeIngredients.map((i) => i.name);

  const items = (extractedItems || []).slice(0, 100).map((rawItem, idx) => {
    const rawName = String(rawItem?.raw_name || "").trim().slice(0, LIMITS.NAME_MAX_LEN);
    const normRaw = normalizeName(rawName);

    let matchedIng = null;
    let matchConfidence = "UNMATCHED";

    if (normRaw) {
      const exact = activeIngredients.find((i) => normalizeName(i.name) === normRaw);
      if (exact) {
        matchedIng = exact;
        matchConfidence = "HIGH";
      } else {
        const similarName = findSimilarName(rawName, ingNames);
        if (similarName) {
          matchedIng = activeIngredients.find((i) => i.name === similarName) || null;
          matchConfidence = matchedIng ? "HIGH" : "UNMATCHED";
        }
      }

      if (!matchedIng) {
        let bestScore = 0;
        let bestCandidate = null;
        for (const ing of activeIngredients) {
          const score = computeTokenOverlapScore(rawName, ing.name);
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = ing;
          }
        }
        if (bestCandidate && bestScore >= 0.4) {
          matchedIng = bestCandidate;
          matchConfidence = bestScore >= 0.75 ? "HIGH" : "MEDIUM";
        }
      }
    }

    if (!matchedIng) {
      warnings.push(`Line ${idx + 1}: Could not match "${rawName || "Unknown item"}" to an active raw material.`);
    }

    // Validate quantity bounds
    let validatedQty = null;
    try {
      validatedQty = validateNumberBound(rawItem?.quantity, {
        label: `Line ${idx + 1} quantity`,
        min: LIMITS.PO_QTY_MIN,
        max: LIMITS.PO_QTY_MAX,
        allowZero: false
      });
    } catch (err) {
      warnings.push(err.message);
      const fallbackNum = Number(rawItem?.quantity);
      if (Number.isFinite(fallbackNum) && fallbackNum > 0) {
        validatedQty = Math.min(LIMITS.PO_QTY_MAX, Math.max(LIMITS.PO_QTY_MIN, fallbackNum));
      } else {
        validatedQty = 1;
      }
    }

    // Validate unit price bounds if supplied
    let validatedUnitPrice = null;
    if (rawItem?.unit_price !== undefined && rawItem?.unit_price !== null && rawItem?.unit_price !== "") {
      try {
        validatedUnitPrice = validateNumberBound(rawItem.unit_price, {
          label: `Line ${idx + 1} unit price`,
          min: LIMITS.PURCHASE_COST_MIN,
          max: LIMITS.PURCHASE_COST_MAX
        });
      } catch (err) {
        warnings.push(err.message);
      }
    }

    // Validate expiry date
    let normalizedExpiry = null;
    if (rawItem?.expiry_date) {
      normalizedExpiry = normalizeOcrDate(rawItem.expiry_date);
      if (!normalizedExpiry) {
        warnings.push(`Line ${idx + 1}: Unrecognized expiry date "${rawItem.expiry_date}".`);
      } else if (normalizedExpiry < todayManila) {
        warnings.push(`Line ${idx + 1}: Expiry date ${normalizedExpiry} for "${matchedIng?.name || rawName}" is already expired.`);
      }
    }

    // Validate batch code
    let cleanBatchCode = null;
    if (rawItem?.batch_code) {
      const trimmedCode = String(rawItem.batch_code).trim();
      if (trimmedCode.length > LIMITS.BATCH_CODE_MAX_LEN) {
        warnings.push(`Line ${idx + 1}: Batch code exceeded ${LIMITS.BATCH_CODE_MAX_LEN} characters and was truncated.`);
      }
      cleanBatchCode = trimmedCode.slice(0, LIMITS.BATCH_CODE_MAX_LEN);
    }

    return {
      raw_name: rawName,
      matched_ingredient_id: matchedIng?.id || null,
      matched_ingredient_name: matchedIng?.name || null,
      matched_unit: matchedIng?.unit || null,
      match_confidence: matchConfidence,
      needs_review: matchConfidence !== "HIGH",
      quantity: validatedQty,
      unit: (() => {
        const u = rawItem?.unit ? normalizeOcrUnit(rawItem.unit) : null;
        return u && OCR_UNITS.has(String(u).toUpperCase()) ? u : (matchedIng?.purchase_unit || matchedIng?.unit || null);
      })(),
      unit_price: validatedUnitPrice,
      expiry_date: normalizedExpiry,
      batch_code: cleanBatchCode
    };
  });

  return { items, warnings };
};

const callGeminiVisionOcr = async ({ base64Data, mimeType }) => {
  const apiKeys = [
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP
  ].filter(Boolean);

  if (apiKeys.length === 0) return null;

  const targetModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const prompt = `Extract supplier delivery receipt or expiry label data from this image.
Return ONLY valid JSON matching:
{
  "supplier_name": string | null,
  "invoice_number": string | null,
  "invoice_date": "YYYY-MM-DD" | null,
  "items": [
    {
      "raw_name": string,
      "quantity": number,
      "unit": string | null,
      "unit_price": number | null,
      "expiry_date": "YYYY-MM-DD" | null,
      "batch_code": string | null
    }
  ]
}
Normalize dates to YYYY-MM-DD. If no items are visible, return {"supplier_name": null, "invoice_number": null, "invoice_date": null, "items": []}.`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  for (const apiKey of apiKeys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`Gemini OCR request failed (${response.status}): ${body.slice(0, 500)}`);
        continue;
      }
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.items)) {
        return parsed;
      }
    } catch (err) {
      console.error("Gemini OCR error:", err?.message || err);
    }
  }

  return null;
};

export const scanInventoryDocument = async ({
  base64Image = null,
  mimeType = null,
  fileName = null,
  rawText = "",
  scanMode = "PO_RECEIPT"
} = {}) => {
  const hasImage = Boolean(base64Image && String(base64Image).trim());
  const cleanRawText = typeof rawText === "string" ? rawText.trim() : "";
  if (cleanRawText.length > 20000) {
    throw createHttpError(400, "Receipt or label text must be at most 20,000 characters.");
  }
  const hasText = Boolean(cleanRawText);

  if (!hasImage && !hasText) {
    throw createHttpError(400, "Please upload an image or enter receipt/label text to scan.");
  }

  let validatedImage = null;
  if (hasImage) {
    validatedImage = validateImageInput(base64Image, mimeType);
  }

  const { data: ingredients, error: ingErr } = await supabase
    .from("ingredients")
    .select("id, name, unit, purchase_unit, conversion_factor, cost_per_purchase_unit, category, is_archived")
    .neq("is_archived", true);
  if (ingErr) throw ingErr;

  let engine = "deterministic_parser";
  let extracted = null;
  const extraWarnings = [];

  if (validatedImage) {
    const visionResult = await callGeminiVisionOcr(validatedImage);
    if (visionResult && Array.isArray(visionResult.items) && visionResult.items.length > 0) {
      engine = "gemini_vision";
      extracted = visionResult;
    } else if (!hasText) {
      extraWarnings.push(
        "Image OCR service could not extract line items (API key missing or unreadable image). Paste receipt text below to parse offline."
      );
      extracted = { supplier_name: null, invoice_number: null, invoice_date: null, items: [] };
    }
  }

  if (!extracted && hasText) {
    extracted = parseReceiptText(cleanRawText);
  }

  const matched = matchExtractedItemsToIngredients(extracted?.items || [], ingredients || []);

  return {
    engine,
    scan_mode: String(scanMode || "PO_RECEIPT").toUpperCase(),
    file_name: fileName || null,
    supplier_name: extracted?.supplier_name || null,
    invoice_number: extracted?.invoice_number || null,
    invoice_date: extracted?.invoice_date ? normalizeOcrDate(extracted.invoice_date) : null,
    items: matched.items,
    warnings: [...extraWarnings, ...matched.warnings]
  };
};

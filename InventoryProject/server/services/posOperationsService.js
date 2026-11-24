import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { supabase } from "../config/supabaseClient.js";
import { convertToBaseUnit } from "../utils/unitUtils.js";
import { getManilaDateOnly, getManilaISOString, toManilaStartOfDay } from "../utils/dateUtils.js";
import { logAudit } from "../utils/auditHelper.js";
import { LIMITS, validateNumberBound, validateTextLength } from "../utils/validationHelper.js";
import * as batchService from "./batchService.js";
import * as recipesService from "./recipesService.js";
import { adjustProductStock, getSugarScaleMultiplier, resolvePackagingIngredientIds } from "./posService.js";

const IDEMPOTENCY_STORE_KEY = "pos_idempotency_store";
const SHIFTS_STORE_KEY = "pos_shifts_store";
const VOIDS_STORE_KEY = "pos_voids_refunds_store";
const KDS_STORE_KEY = "pos_kds_queue_store";
const MANAGER_PINS_STORE_KEY = "manager_pins_store";
const SALE_METADATA_STORE_KEY = "pos_sale_metadata_store";
const CATEGORY_STATIONS_STORE_KEY = "category_prep_stations_map";
const POS_SETTINGS_STORE_KEY = "pos_store_settings";

const MAX_IDEMPOTENCY_KEYS = 300;
const MAX_KDS_TICKETS = 100;
const MAX_SHIFTS_HISTORY = 200;
const PIN_MAX_ATTEMPTS = 10;
const PIN_WINDOW_MS = 5 * 60 * 1000;

export const ALLOWED_METHODS = ["CASH", "GCASH", "MAYA", "CARD", "QRPH", "SPLIT"];
const SINGLE_PAYMENT_METHODS = ["CASH", "GCASH", "MAYA", "CARD", "QRPH"];
const NON_CASH_METHODS = ["GCASH", "MAYA", "CARD", "QRPH"];
const QR_PROVIDERS = ["GCASH", "MAYA", "QRPH"];
const ALLOWED_KDS_STATUSES = ["PENDING", "PREPARING", "READY", "SERVED", "CANCELLED"];

let hasNativeSalePaymentsTable = null;
let hasNativePosShiftsTable = null;
let hasNativeSaleVoidsTable = null;
let hasNativeKdsTicketsTable = null;
let hasNativeUserPinCol = null;

const pinFailureBuckets = new Map();
const storeLocks = new Map();
const inFlightIdempotency = new Map();

const round2 = (val) => Math.round((Number(val) || 0) * 100) / 100;
const round6 = (val) => Math.max(0, Math.round((Number(val) || 0) * 1e6) / 1e6);

const createHttpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const withStoreLock = async (key, fn) => {
  const prev = storeLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  storeLocks.set(key, prev.then(() => current, () => current));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (storeLocks.get(key) === current) {
      storeLocks.delete(key);
    }
  }
};

const isMissingTableError = (err) => {
  if (!err) return false;
  const msg = String(err.message || "");
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    /relation .* does not exist/i.test(msg) ||
    /could not find the table/i.test(msg)
  );
};

const isMissingColumnError = (err) => {
  if (!err) return false;
  const msg = String(err.message || "");
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    /column .* does not exist/i.test(msg) ||
    /could not find the .* column/i.test(msg)
  );
};

const readCmsStore = async (sectionKey, fallback) => {
  const { data, error } = await supabase
    .from("cms_content")
    .select("description")
    .eq("section_key", sectionKey)
    .maybeSingle();

  if (error) throw error;
  if (!data?.description) return fallback;
  try {
    const parsed = JSON.parse(data.description);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeCmsStore = async (sectionKey, title, payload) => {
  const { error } = await supabase
    .from("cms_content")
    .upsert(
      {
        section_key: sectionKey,
        title,
        description: JSON.stringify(payload)
      },
      { onConflict: "section_key" }
    );
  if (error) throw error;
};

const normalizeCategoryKey = (cat) =>
  String(cat || "").trim().replace(/\s+/g, " ").toUpperCase();

const parseAddOnEntry = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const DEFAULT_DISCOUNT_TYPES = [
  { id: "SENIOR", label: "Senior Citizen", rate_percent: 20, requires_id: true, vat_exempt: true, active: true },
  { id: "PWD", label: "PWD", rate_percent: 20, requires_id: true, vat_exempt: true, active: true },
  { id: "STUDENT", label: "Student", rate_percent: 10, requires_id: false, vat_exempt: false, active: true },
  { id: "STAFF", label: "Employee / Staff", rate_percent: 15, requires_id: false, vat_exempt: false, active: true }
];

const RESERVED_DISCOUNT_IDS = new Set(["NONE", "PROMO", "PROMO_CODE", "CUSTOM"]);

export const DEFAULT_POS_SETTINGS = {
  promo_codes: [
    { code: "COFTEA10", type: "PERCENT", value: 10, min_subtotal: 0, active: true, description: "10% off order" },
    { code: "COFTEA20", type: "PERCENT", value: 20, min_subtotal: 0, active: true, description: "20% off order" },
    { code: "WELCOME50", type: "FIXED", value: 50, min_subtotal: 200, active: true, description: "₱50 off min ₱200" },
    { code: "B1T1", type: "B1T1", value: 0, min_subtotal: 0, active: true, description: "Buy 1 Take 1 (free lowest item)" }
  ],
  discount_presets: {
    senior_rate: 0.20,
    pwd_rate: 0.20,
    student_rate: 0.10,
    staff_rate: 0.15
  },
  discount_types: DEFAULT_DISCOUNT_TYPES,
  ewallet_accounts: {
    GCASH: {
      account_name: "CofTea Cafe",
      account_number: "",
      qr_image_url: "",
      instructions: "Scan QR or send to GCash number and enter the Reference #."
    },
    MAYA: {
      account_name: "CofTea Cafe",
      account_number: "",
      qr_image_url: "",
      instructions: "Scan QR or send to Maya number and enter the Reference #."
    },
    QRPH: {
      account_name: "CofTea Cafe",
      account_number: "",
      qr_image_url: "",
      instructions: "Scan QRPH code and enter the Reference #."
    }
  },
  takeout_packaging: {
    carrier_ingredient_id: null,
    carrier_qty_per_order: 1,
    apply_to_takeout: true,
    apply_to_delivery: true
  }
};

const isSafeOptionalUrl = (val) => {
  if (!val) return true;
  const s = String(val).trim();
  if (!s) return true;
  return s.startsWith("https://") || s.startsWith("http://") || s.startsWith("/");
};

export const normalizePosSettings = (raw = {}, { strict = false } = {}) => {
  const src = raw && typeof raw === "object" ? raw : {};

  const rawPromos = Array.isArray(src.promo_codes) ? src.promo_codes : DEFAULT_POS_SETTINGS.promo_codes;
  const seenCodes = new Set();
  const promo_codes = [];

  for (const entry of rawPromos.slice(0, 50)) {
    const code = String(entry?.code || "").trim().toUpperCase();
    if (!code) {
      if (strict) throw createHttpError(400, "Each promo entry must have a code.");
      continue;
    }
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
      if (strict) throw createHttpError(400, `Promo code "${code}" must be 2-30 alphanumeric characters (A-Z, 0-9, -, _).`);
      continue;
    }
    if (seenCodes.has(code)) {
      if (strict) throw createHttpError(400, `Duplicate promo code "${code}" is not allowed.`);
      continue;
    }
    seenCodes.add(code);

    const pType = String(entry?.type || "PERCENT").trim().toUpperCase();
    if (!["PERCENT", "FIXED", "B1T1"].includes(pType)) {
      if (strict) throw createHttpError(400, `Invalid promo type "${entry?.type}" for ${code}.`);
      continue;
    }

    let pVal = Number(entry?.value ?? 0);
    if (pType === "B1T1") {
      pVal = 0;
    } else if (pType === "PERCENT") {
      if (!Number.isFinite(pVal) || pVal <= 0 || pVal > 100) {
        if (strict) throw createHttpError(400, `Percentage for promo "${code}" must be between 1 and 100.`);
        pVal = Math.min(100, Math.max(1, Number.isFinite(pVal) ? pVal : 10));
      }
      pVal = round2(pVal);
    } else {
      if (!Number.isFinite(pVal) || pVal <= 0 || pVal > 100000) {
        if (strict) throw createHttpError(400, `Fixed amount for promo "${code}" must be between ₱1 and ₱100,000.`);
        pVal = Math.min(100000, Math.max(1, Number.isFinite(pVal) ? pVal : 50));
      }
      pVal = round2(pVal);
    }

    let minSub = Number(entry?.min_subtotal ?? 0);
    if (!Number.isFinite(minSub) || minSub < 0 || minSub > 100000) {
      if (strict) throw createHttpError(400, `Minimum subtotal for promo "${code}" must be between 0 and 100,000.`);
      minSub = 0;
    }

    promo_codes.push({
      code,
      type: pType,
      value: pVal,
      min_subtotal: round2(minSub),
      active: entry?.active !== false,
      description: String(entry?.description || "").trim().slice(0, 120)
    });
  }

  const rawPresets = src.discount_presets && typeof src.discount_presets === "object"
    ? src.discount_presets
    : {};
  const clampRate = (val, fallback, label) => {
    const n = Number(val);
    if (val === undefined || val === null || val === "") return fallback;
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      if (strict) throw createHttpError(400, `${label} rate must be between 0% and 100%.`);
      return fallback;
    }
    return Math.round(n * 10000) / 10000;
  };
  const legacyPresets = {
    senior_rate: clampRate(rawPresets.senior_rate, DEFAULT_POS_SETTINGS.discount_presets.senior_rate, "Senior Citizen"),
    pwd_rate: clampRate(rawPresets.pwd_rate, DEFAULT_POS_SETTINGS.discount_presets.pwd_rate, "PWD"),
    student_rate: clampRate(rawPresets.student_rate, DEFAULT_POS_SETTINGS.discount_presets.student_rate, "Student"),
    staff_rate: clampRate(rawPresets.staff_rate, DEFAULT_POS_SETTINGS.discount_presets.staff_rate, "Staff")
  };

  let discount_types = [];
  if (Array.isArray(src.discount_types)) {
    const seenDiscIds = new Set();
    for (const entry of src.discount_types.slice(0, 30)) {
      const rawId = String(entry?.id || entry?.label || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (!rawId) {
        if (strict) throw createHttpError(400, "Each discount type must have a valid identifier or name.");
        continue;
      }
      if (RESERVED_DISCOUNT_IDS.has(rawId)) {
        if (strict) throw createHttpError(400, `Discount ID "${rawId}" is reserved.`);
        continue;
      }
      if (!/^[A-Z0-9_-]{2,30}$/.test(rawId)) {
        if (strict) throw createHttpError(400, `Discount ID "${rawId}" must be 2-30 alphanumeric characters.`);
        continue;
      }
      if (seenDiscIds.has(rawId)) {
        if (strict) throw createHttpError(400, `Duplicate discount ID "${rawId}" is not allowed.`);
        continue;
      }
      seenDiscIds.add(rawId);

      const label = String(entry?.label || rawId).trim().slice(0, 60);
      if (!label) {
        if (strict) throw createHttpError(400, `Discount "${rawId}" requires a label.`);
        continue;
      }
      let ratePct = Number(entry?.rate_percent);
      if (!Number.isFinite(ratePct) || ratePct <= 0 || ratePct > 100) {
        if (strict) throw createHttpError(400, `Discount "${label}" percentage must be between 0.1% and 100%.`);
        ratePct = Math.min(100, Math.max(0.1, Number.isFinite(ratePct) ? ratePct : 10));
      }

      discount_types.push({
        id: rawId,
        label,
        rate_percent: round2(ratePct),
        requires_id: Boolean(entry?.requires_id),
        vat_exempt: Boolean(entry?.vat_exempt),
        active: entry?.active !== false
      });
    }
  } else {
    discount_types = DEFAULT_DISCOUNT_TYPES.map((def) => {
      const ratePct =
        def.id === "SENIOR"
          ? round2(legacyPresets.senior_rate * 100)
          : def.id === "PWD"
          ? round2(legacyPresets.pwd_rate * 100)
          : def.id === "STUDENT"
          ? round2(legacyPresets.student_rate * 100)
          : def.id === "STAFF"
          ? round2(legacyPresets.staff_rate * 100)
          : def.rate_percent;
      return { ...def, rate_percent: ratePct };
    });
  }

  const findTypeRate = (id, fallback) => {
    const match = discount_types.find((d) => d.id === id);
    return match ? Math.round((match.rate_percent / 100) * 10000) / 10000 : fallback;
  };
  const discount_presets = {
    senior_rate: findTypeRate("SENIOR", legacyPresets.senior_rate),
    pwd_rate: findTypeRate("PWD", legacyPresets.pwd_rate),
    student_rate: findTypeRate("STUDENT", legacyPresets.student_rate),
    staff_rate: findTypeRate("STAFF", legacyPresets.staff_rate)
  };

  const rawWallets = src.ewallet_accounts && typeof src.ewallet_accounts === "object"
    ? src.ewallet_accounts
    : {};
  const ewallet_accounts = {};
  for (const prov of QR_PROVIDERS) {
    const def = DEFAULT_POS_SETTINGS.ewallet_accounts[prov];
    const w = rawWallets[prov] && typeof rawWallets[prov] === "object" ? rawWallets[prov] : {};
    const qrUrl = String(w.qr_image_url ?? def.qr_image_url).trim().slice(0, 500);
    if (strict && !isSafeOptionalUrl(qrUrl)) {
      throw createHttpError(400, `Invalid QR image URL for ${prov}. Use an uploaded image or http(s) URL.`);
    }
    ewallet_accounts[prov] = {
      account_name: String(w.account_name ?? def.account_name).trim().slice(0, 100),
      account_number: String(w.account_number ?? def.account_number).trim().slice(0, 40),
      qr_image_url: isSafeOptionalUrl(qrUrl) ? qrUrl : "",
      instructions: String(w.instructions ?? def.instructions).trim().slice(0, 250)
    };
  }

  const rawPkg = src.takeout_packaging && typeof src.takeout_packaging === "object"
    ? src.takeout_packaging
    : {};
  let carrierQty = Number(rawPkg.carrier_qty_per_order ?? 1);
  if (!Number.isFinite(carrierQty) || carrierQty < 0 || carrierQty > 100) {
    if (strict) throw createHttpError(400, "Take-out carrier quantity per order must be between 0 and 100.");
    carrierQty = 1;
  }
  const takeout_packaging = {
    carrier_ingredient_id: rawPkg.carrier_ingredient_id ? String(rawPkg.carrier_ingredient_id).trim() : null,
    carrier_qty_per_order: round2(carrierQty),
    apply_to_takeout: rawPkg.apply_to_takeout !== false,
    apply_to_delivery: rawPkg.apply_to_delivery !== false
  };

  return {
    promo_codes,
    discount_presets,
    discount_types,
    ewallet_accounts,
    takeout_packaging
  };
};

export const getPosSettings = async () => {
  const stored = await readCmsStore(POS_SETTINGS_STORE_KEY, null);
  return normalizePosSettings(stored || {});
};

export const updatePosSettings = async (payload, actingUser) => {
  const normalized = normalizePosSettings(payload, { strict: true });
  await withStoreLock(POS_SETTINGS_STORE_KEY, async () => {
    await writeCmsStore(POS_SETTINGS_STORE_KEY, "POS Store Settings", normalized);
  });

  await logAudit("POS_SETTINGS_UPDATED", actingUser?.id || null, {
    promo_count: normalized.promo_codes.length,
    updated_by: actingUser?.name || "Admin"
  });

  return normalized;
};

/**
 * Pure authoritative pricing calculator from catalog maps (testable without DB).
 */
export const calculateCartPricingFromCatalog = (cart = [], productMap = new Map(), categorySettingsMap = new Map()) => {
  let subtotal = 0;
  const itemPrices = [];

  for (const item of cart) {
    const product = productMap.get(String(item.id));
    if (!product) {
      throw createHttpError(400, `Product not found or archived: ${item.name || item.id}`);
    }

    const qty = Number(item.qty ?? item.quantity) || 0;
    let unitPrice = Math.max(0, parseFloat(product.price) || 0);

    const catSetting = categorySettingsMap.get(normalizeCategoryKey(product.category));
    const catalogSizes = Array.isArray(product.sizes) && product.sizes.length > 0
      ? product.sizes
      : (Array.isArray(catSetting?.sizes) ? catSetting.sizes : []);
    const catalogAddons = Array.isArray(product.add_ons) && product.add_ons.length > 0
      ? product.add_ons
      : (Array.isArray(catSetting?.add_ons) ? catSetting.add_ons : []);

    // Server-side size/add-on objects replace client ones so stock deduction never trusts the payload.
    let catalogSizeObj = null;
    const catalogAddOnsForItem = [];

    const cupSizeName = item.cup_size || item.cup_size_obj?.name || "";
    if (cupSizeName) {
      const normTarget = String(cupSizeName).trim().toLowerCase();
      const matchedSize = catalogSizes.find(
        (s) => String(s?.name || "").trim().toLowerCase() === normTarget
      );
      if (matchedSize) {
        catalogSizeObj = matchedSize;
        unitPrice += Math.max(0, parseFloat(matchedSize.price_add) || 0);
      } else if (catalogSizes.length === 0) {
        if (normTarget === "16 oz") unitPrice += 10;
        else if (normTarget === "22 oz") unitPrice += 20;
      }
    }

    if (Array.isArray(item.add_ons)) {
      for (const rawAo of item.add_ons) {
        const ao = parseAddOnEntry(rawAo);
        if (!ao) continue;
        const aoQty = Math.max(0, parseInt(ao.customer_qty ?? ao.quantity ?? 1, 10) || 0);
        if (aoQty <= 0) continue;

        const normAddonName = String(ao.name || "").trim().toLowerCase();
        const matchedAddon = catalogAddons.find(
          (a) => String(a?.name || "").trim().toLowerCase() === normAddonName
        );
        if (matchedAddon) {
          unitPrice += Math.max(0, parseFloat(matchedAddon.price) || 0) * aoQty;
          catalogAddOnsForItem.push({ ...matchedAddon, customer_qty: aoQty });
        } else if ((parseFloat(ao.price) || 0) > 0 || ao.ingredient_id) {
          throw createHttpError(400, `Add-on "${ao.name || "unknown"}" is not available for ${product.name}.`);
        } else {
          // Legacy free label add-on (POS DEFAULT_ADDONS): no price, no inventory link.
          catalogAddOnsForItem.push({ name: String(ao.name || "Add-on").slice(0, 100), price: 0, customer_qty: aoQty });
        }
      }
    }

    // Client item.discount_percent is ignored; discounts come only from server-configured types.
    const netUnitPrice = round2(unitPrice);
    const lineTotal = round2(netUnitPrice * qty);

    subtotal = round2(subtotal + lineTotal);
    itemPrices.push({
      id: item.id,
      qty,
      unit_price: netUnitPrice,
      line_total: lineTotal,
      cup_size_obj: catalogSizeObj,
      add_ons: catalogAddOnsForItem
    });
  }

  return { subtotal: round2(subtotal), itemPrices };
};

export const computeAuthoritativeSubtotal = async (cart = []) => {
  const productIds = [...new Set(cart.map((i) => i?.id).filter(Boolean))];
  if (productIds.length === 0) {
    throw createHttpError(400, "Cart cannot be empty.");
  }

  const [{ data: products, error: prodErr }, { data: catSettings, error: catErr }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category, price, sizes, add_ons")
      .eq("is_archived", false)
      .in("id", productIds),
    supabase.from("category_settings").select("category, sizes, add_ons")
  ]);

  if (prodErr) throw prodErr;
  if (catErr) throw catErr;

  const productMap = new Map((products || []).map((p) => [String(p.id), p]));
  const categorySettingsMap = new Map(
    (catSettings || []).map((c) => [normalizeCategoryKey(c.category), c])
  );

  return calculateCartPricingFromCatalog(cart, productMap, categorySettingsMap);
};

/**
 * RA 9994 / RA 10754 Senior/PWD discount: VAT removed + rate x VAT-exclusive price.
 * computeVatExemptDiscount(112, 0.2) === 32 (final 80.00).
 */
export const computeVatExemptDiscount = (subtotal, rate) => {
  const vatExclusive = subtotal / 1.12;
  return round2(vatExclusive * rate + (subtotal - vatExclusive));
};

/**
 * Authoritative discount computation and validation.
 */
export const validateAndComputeDiscount = ({
  subtotal,
  cart = [],
  itemPrices = [],
  discount_type = "NONE",
  discount_id_number = "",
  customer_name = "",
  promo_code = "",
  custom_discount_mode = "PERCENT",
  custom_discount_value = 0,
  posSettings = null
}) => {
  const settings = normalizePosSettings(posSettings || DEFAULT_POS_SETTINGS);
  const safeSubtotal = Math.max(0, round2(subtotal));
  let type = String(discount_type || "NONE").trim().toUpperCase();
  if (type === "PROMO") type = "PROMO_CODE";

  let discountAmount = 0;
  let discountLabel = "";
  const discountDetails = {
    discount_type: type
  };

  if (type === "NONE") {
    discountAmount = 0;
    discountLabel = "";
  } else if (type === "PROMO_CODE") {
    const code = String(promo_code || "").trim().toUpperCase();
    if (!code) {
      throw createHttpError(400, "Promo code is required.");
    }
    const matchedPromo = (settings.promo_codes || []).find(
      (p) => String(p.code || "").trim().toUpperCase() === code && p.active !== false
    );
    if (!matchedPromo) {
      throw createHttpError(400, `Invalid or inactive promo code "${code}".`);
    }
    if (matchedPromo.min_subtotal > 0 && safeSubtotal < matchedPromo.min_subtotal) {
      throw createHttpError(
        400,
        `Promo code ${code} requires a minimum subtotal of ₱${Number(matchedPromo.min_subtotal).toFixed(2)}.`
      );
    }

    if (matchedPromo.type === "PERCENT") {
      discountAmount = round2(safeSubtotal * (Number(matchedPromo.value || 0) / 100));
      discountLabel = `Promo ${code} (${matchedPromo.value}%)`;
    } else if (matchedPromo.type === "FIXED") {
      discountAmount = round2(Number(matchedPromo.value || 0));
      discountLabel = `Promo ${code} (-₱${discountAmount.toFixed(2)})`;
    } else if (matchedPromo.type === "B1T1") {
      const totalQty = (cart || []).reduce((sum, i) => sum + (Number(i?.qty ?? i?.quantity) || 0), 0);
      if (totalQty < 2) {
        throw createHttpError(400, `Promo code ${code} requires at least 2 items in the cart.`);
      }
      const candidateUnitPrices = (itemPrices.length > 0 ? itemPrices : cart)
        .filter((i) => (Number(i?.qty ?? i?.quantity) || 0) > 0)
        .map((i) => parseFloat(i?.unit_price ?? i?.price) || 0)
        .filter((p) => p > 0);
      if (candidateUnitPrices.length === 0) {
        throw createHttpError(400, `No eligible priced items found for ${code}.`);
      }
      discountAmount = round2(Math.min(...candidateUnitPrices));
      discountLabel = `Promo ${code} (Free Cheapest Item)`;
    }
    discountDetails.promo_code = code;
  } else if (type === "CUSTOM") {
    const mode = String(custom_discount_mode || "PERCENT").trim().toUpperCase();
    const val = Number(custom_discount_value);
    if (!Number.isFinite(val) || val <= 0) {
      throw createHttpError(400, "Custom discount value must be greater than 0.");
    }
    if (mode === "PERCENT") {
      if (val > 100) {
        throw createHttpError(400, "Custom discount percentage cannot exceed 100%.");
      }
      discountAmount = round2(safeSubtotal * (val / 100));
      discountLabel = `Custom (${val}%)`;
    } else if (mode === "AMOUNT") {
      if (val > safeSubtotal) {
        throw createHttpError(400, "Custom discount amount cannot exceed the subtotal.");
      }
      discountAmount = round2(val);
      discountLabel = `Custom (-₱${discountAmount.toFixed(2)})`;
    } else {
      throw createHttpError(400, "Invalid custom_discount_mode. Must be PERCENT or AMOUNT.");
    }
    discountDetails.custom_discount_mode = mode;
    discountDetails.custom_discount_value = val;
  } else {
    const matchedDiscount = (settings.discount_types || []).find(
      (d) => String(d.id || "").trim().toUpperCase() === type && d.active !== false
    );
    if (!matchedDiscount) {
      throw createHttpError(400, `Unsupported or inactive discount type "${discount_type}".`);
    }

    if (matchedDiscount.requires_id) {
      const cleanName = validateTextLength(customer_name, {
        label: "Customer name",
        min: 2,
        max: 100,
        required: true
      });
      const cleanId = validateTextLength(discount_id_number, {
        label: `${matchedDiscount.label} ID number`,
        min: 3,
        max: 40,
        required: true
      });
      discountDetails.customer_name = cleanName;
      discountDetails.discount_id_number = cleanId;
    }

    const rate = Number(matchedDiscount.rate_percent || 0) / 100;
    discountAmount = matchedDiscount.vat_exempt
      ? computeVatExemptDiscount(safeSubtotal, rate)
      : round2(safeSubtotal * rate);
    if (matchedDiscount.vat_exempt) {
      const vatExemptSales = round2(safeSubtotal / 1.12);
      const vatDeducted = round2(safeSubtotal - vatExemptSales);
      discountDetails.vat_exempt_sales = vatExemptSales;
      discountDetails.vat_deducted = vatDeducted;
    }
    discountLabel = `${matchedDiscount.label} (${matchedDiscount.rate_percent}%)`;
  }

  discountAmount = Math.min(safeSubtotal, Math.max(0, round2(discountAmount)));
  const finalTotal = Math.max(0, round2(safeSubtotal - discountAmount));
  discountDetails.discount_label = discountLabel;
  discountDetails.discount_amount = discountAmount;
  discountDetails.subtotal = safeSubtotal;
  discountDetails.final_total = finalTotal;

  return {
    discount_type: type,
    discount_amount: discountAmount,
    discount_label: discountLabel,
    subtotal: safeSubtotal,
    final_total: finalTotal,
    discount_details: discountDetails
  };
};

/**
 * Validates single or split payments and computes change / reference metadata.
 */
export const validateAndNormalizePayments = ({
  payment_method = "CASH",
  amount_received = 0,
  transaction_reference = "",
  payments = null,
  finalTotal = 0
}) => {
  const method = String(payment_method || "CASH").trim().toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    throw createHttpError(400, `Unsupported payment method "${payment_method}".`);
  }

  const targetTotal = Math.max(0, round2(finalTotal));

  if (method === "SPLIT") {
    if (!Array.isArray(payments) || payments.length < 2 || payments.length > 4) {
      throw createHttpError(400, "Split payment requires between 2 and 4 payment legs.");
    }

    const normalizedLegs = [];
    let nonCashSum = 0;
    let totalPaid = 0;

    for (const leg of payments) {
      const legMethod = String(leg?.method || "").trim().toUpperCase();
      if (!SINGLE_PAYMENT_METHODS.includes(legMethod)) {
        throw createHttpError(400, `Invalid split payment leg method "${leg?.method}".`);
      }

      const legAmount = validateNumberBound(leg?.amount, {
        label: `${legMethod} split amount`,
        min: 0.01,
        max: 1000000,
        allowZero: false
      });

      let ref = null;
      if (NON_CASH_METHODS.includes(legMethod)) {
        ref = validateTextLength(leg?.reference_number ?? leg?.reference ?? "", {
          label: `${legMethod} reference number`,
          min: 4,
          max: 60,
          required: true
        });
        nonCashSum = round2(nonCashSum + legAmount);
      }

      totalPaid = round2(totalPaid + legAmount);
      normalizedLegs.push({
        method: legMethod,
        amount: round2(legAmount),
        reference_number: ref
      });
    }

    if (nonCashSum > targetTotal + 0.01) {
      throw createHttpError(400, "Non-cash split payment legs cannot exceed the final order total.");
    }
    if (totalPaid + 0.01 < targetTotal) {
      throw createHttpError(400, `Split payment total (₱${totalPaid.toFixed(2)}) is less than final total (₱${targetTotal.toFixed(2)}).`);
    }

    const changeAmount = Math.max(0, round2(totalPaid - targetTotal));
    const joinedRef = normalizedLegs.map((l) => l.reference_number).filter(Boolean).join(", ");

    return {
      payment_method: "SPLIT",
      amount_received: totalPaid,
      change_amount: changeAmount,
      transaction_reference: joinedRef,
      payments: normalizedLegs
    };
  }

  if (NON_CASH_METHODS.includes(method)) {
    const cleanRef = validateTextLength(transaction_reference, {
      label: `${method} reference number`,
      min: 4,
      max: 60,
      required: true
    });
    return {
      payment_method: method,
      amount_received: targetTotal,
      change_amount: 0,
      transaction_reference: cleanRef,
      payments: [{ method, amount: targetTotal, reference_number: cleanRef }]
    };
  }

  const received = validateNumberBound(amount_received, {
    label: "Cash received",
    min: 0,
    max: 100000
  });
  const maxCash = Math.min(100000, Math.max(targetTotal + 5000, 50000));
  if (received + 0.01 < targetTotal) {
    throw createHttpError(400, "Cash received must be greater than or equal to total.");
  }
  if (received > maxCash) {
    throw createHttpError(400, `Cash received exceeds allowable maximum of ₱${maxCash.toLocaleString()}.`);
  }

  const changeAmount = Math.max(0, round2(received - targetTotal));
  return {
    payment_method: "CASH",
    amount_received: round2(received),
    change_amount: changeAmount,
    transaction_reference: "",
    payments: [{ method: "CASH", amount: round2(received), reference_number: null }]
  };
};

export const generateQrPaymentIntent = ({ provider, amount }) => {
  const prov = String(provider || "").trim().toUpperCase();
  if (!QR_PROVIDERS.includes(prov)) {
    throw createHttpError(400, "QR payment provider must be GCASH, MAYA, or QRPH.");
  }
  const amt = round2(
    validateNumberBound(amount, {
      label: "QR payment amount",
      min: 0.01,
      max: 1000000,
      allowZero: false
    })
  );
  const intent_id = `QRI-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const mode = process.env.PAYMENT_WEBHOOK_SECRET ? "LIVE_WEBHOOK" : "MANUAL_REFERENCE_VERIFICATION";
  const qr_payload = `COFTEA|${prov}|${intent_id}|PHP|${amt.toFixed(2)}|${expires_at}`;

  return {
    intent_id,
    provider: prov,
    amount: amt,
    qr_payload,
    mode,
    expires_at
  };
};

// Stable sha256 of the checkout fields that decide what is sold and paid, so a reused key
// cannot replay a changed cart.
export const hashCheckoutPayload = (body = {}) => {
  const canon = {
    cart: (Array.isArray(body.cart) ? body.cart : []).map((i) => ({
      id: i?.id,
      qty: i?.qty,
      size: i?.cup_size || i?.cup_size_obj?.name || null,
      add_ons: (Array.isArray(i?.add_ons) ? i.add_ons : [])
        .map((a) => [a?.id ?? a?.name ?? null, Number(a?.customer_qty ?? a?.quantity ?? 1)])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    })),
    discount: [
      body.discount_type ?? null,
      body.promo_code || null,
      body.custom_discount_mode || null,
      Number(body.custom_discount_value) || null,
      body.discount_id_number || null
    ],
    payment: [
      body.payment_method ?? null,
      Number(body.amount_received) || 0,
      Array.isArray(body.payments)
        ? body.payments.map((p) => [p?.method, Number(p?.amount) || 0, p?.reference_number || null])
        : null
    ]
  };
  return crypto.createHash("sha256").update(JSON.stringify(canon)).digest("hex");
};

const idempotencyMismatch = () => createHttpError(409, "This checkout changed; please submit again.");

const findIdempotencyEntry = async (key, userId) => {
  if (!key || typeof key !== "string" || !key.trim()) return null;
  const compositeKey = `${userId || "anon"}:${key.trim()}`;
  const store = await readCmsStore(IDEMPOTENCY_STORE_KEY, { entries: [] });
  const entries = Array.isArray(store.entries) ? store.entries : [];
  return entries.find((e) => e.key === compositeKey) || null;
};

export const checkIdempotencyKey = async (key, userId) => (await findIdempotencyEntry(key, userId))?.sale ?? null;

export const recordIdempotencyKey = async (key, userId, sale, payloadHash = null) => {
  if (!key || typeof key !== "string" || !key.trim() || !sale) return;
  const compositeKey = `${userId || "anon"}:${key.trim()}`;
  await withStoreLock(IDEMPOTENCY_STORE_KEY, async () => {
    const store = await readCmsStore(IDEMPOTENCY_STORE_KEY, { entries: [] });
    const entries = Array.isArray(store.entries) ? store.entries : [];
    const filtered = entries.filter((e) => e.key !== compositeKey);
    const updated = [{ key: compositeKey, sale, hash: payloadHash, created_at: getManilaISOString() }, ...filtered].slice(
      0,
      MAX_IDEMPOTENCY_KEYS
    );
    await writeCmsStore(IDEMPOTENCY_STORE_KEY, "POS Idempotency Store", { entries: updated });
  });
};

export const runWithIdempotency = async (key, userId, executor, payloadHash = null) => {
  const cleanKey = typeof key === "string" ? key.trim() : "";
  if (!cleanKey) {
    return { sale: await executor(), deduplicated: false };
  }

  // Entries stored before hashing existed have no hash and are treated as matching.
  const sameHash = (stored) => !payloadHash || !stored || stored === payloadHash;

  const existing = await findIdempotencyEntry(cleanKey, userId);
  if (existing) {
    if (!sameHash(existing.hash)) throw idempotencyMismatch();
    return { sale: existing.sale, deduplicated: true };
  }

  const compositeKey = `${userId || "anon"}:${cleanKey}`;
  if (inFlightIdempotency.has(compositeKey)) {
    const inflight = inFlightIdempotency.get(compositeKey);
    const sale = await inflight;
    if (!sameHash(inflight.payloadHash)) throw idempotencyMismatch();
    return { sale, deduplicated: true };
  }

  const pendingPromise = (async () => {
    const again = await findIdempotencyEntry(cleanKey, userId);
    if (again) {
      if (!sameHash(again.hash)) throw idempotencyMismatch();
      return again.sale;
    }
    const sale = await executor();
    try {
      await recordIdempotencyKey(cleanKey, userId, sale, payloadHash);
    } catch (recErr) {
      // The sale is committed; returning success stops the client retrying. shortcut: a retry after this
      // failure is not deduplicated, upgrade by storing the key on the sales row once a column exists.
      console.error("[POS] Idempotency record failed for committed sale", sale?.id, recErr);
    }
    return sale;
  })();

  pendingPromise.payloadHash = payloadHash;
  inFlightIdempotency.set(compositeKey, pendingPromise);
  try {
    const sale = await pendingPromise;
    return { sale, deduplicated: false };
  } finally {
    inFlightIdempotency.delete(compositeKey);
  }
};

export const saveSaleMetadata = async (saleId, { payments = [], discount_details = null, order_type = "DINE_IN" }) => {
  if (!saleId) return;
  await withStoreLock(SALE_METADATA_STORE_KEY, async () => {
    const map = await readCmsStore(SALE_METADATA_STORE_KEY, {});
    map[saleId] = {
      payments: Array.isArray(payments) ? payments : [],
      discount_details: discount_details || null,
      order_type: order_type || "DINE_IN",
      recorded_at: getManilaISOString()
    };
    await writeCmsStore(SALE_METADATA_STORE_KEY, "POS Sale Metadata Store", map);
  });

  if (hasNativeSalePaymentsTable !== false && Array.isArray(payments) && payments.length > 0) {
    try {
      const rows = payments.map((leg) => ({
        sale_id: saleId,
        method: leg.method,
        amount: leg.amount,
        reference_number: leg.reference_number || null
      }));
      const { error } = await supabase.from("sale_payments").insert(rows);
      if (error) {
        if (isMissingTableError(error)) hasNativeSalePaymentsTable = false;
      } else {
        hasNativeSalePaymentsTable = true;
      }
    } catch (err) {
      if (isMissingTableError(err)) hasNativeSalePaymentsTable = false;
    }
  }
};

export const getSaleMetadataMap = async () => {
  const store = await readCmsStore(SALE_METADATA_STORE_KEY, {});
  return store && typeof store === "object" && !Array.isArray(store) ? store : {};
};

export const getVoidRefundMap = async () => {
  const store = await readCmsStore(VOIDS_STORE_KEY, {});
  return store && typeof store === "object" && !Array.isArray(store) ? store : {};
};

export const checkPinRateLimit = (rateKey = "global", now = Date.now()) => {
  const bucket = pinFailureBuckets.get(rateKey);
  if (!bucket) return;
  if (now - bucket.firstAttemptAt > PIN_WINDOW_MS) {
    pinFailureBuckets.delete(rateKey);
    return;
  }
  if (bucket.count >= PIN_MAX_ATTEMPTS) {
    throw createHttpError(429, "Too many invalid Manager PIN attempts. Please try again in 5 minutes.");
  }
};

export const recordPinFailure = (rateKey = "global", now = Date.now()) => {
  const bucket = pinFailureBuckets.get(rateKey);
  if (!bucket || now - bucket.firstAttemptAt > PIN_WINDOW_MS) {
    pinFailureBuckets.set(rateKey, { count: 1, firstAttemptAt: now });
  } else {
    bucket.count += 1;
  }
};

export const clearPinFailures = (rateKey = "global") => {
  pinFailureBuckets.delete(rateKey);
};

export const getManagerPinStatus = async () => {
  const [{ data: managers, error }, pinsMap] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, username, role, status")
      .in("role", ["Owner", "Admin"])
      .eq("status", "ACTIVE")
      .order("role", { ascending: false }),
    readCmsStore(MANAGER_PINS_STORE_KEY, {})
  ]);
  if (error) throw error;

  const list = (managers || []).map((u) => {
    const entry = pinsMap?.[u.id];
    return {
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      has_custom_pin: Boolean(entry?.hash),
      pin_updated_at: entry?.updated_at || null
    };
  });

  return {
    has_any_custom_pin: list.some((m) => m.has_custom_pin),
    managers: list
  };
};

export const setManagerPin = async ({ targetUserId, pin, actingUser }) => {
  const pinStr = String(pin ?? "").trim();
  if (!/^\d{4,8}$/.test(pinStr)) {
    throw createHttpError(400, "Manager PIN must be 4 to 8 numeric digits.");
  }

  const effectiveTargetId = targetUserId || actingUser?.id;
  if (!effectiveTargetId) {
    throw createHttpError(400, "Target user ID is required.");
  }

  const { data: targetUser } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", effectiveTargetId)
    .maybeSingle();

  if (
    actingUser?.role === "Admin" &&
    targetUser?.role === "Owner" &&
    String(targetUser.id) !== String(actingUser.id)
  ) {
    throw createHttpError(403, "Only the Owner can change the Owner Manager PIN.");
  }

  const hash = await bcrypt.hash(pinStr, 10);

  await withStoreLock(MANAGER_PINS_STORE_KEY, async () => {
    const map = await readCmsStore(MANAGER_PINS_STORE_KEY, {});
    map[effectiveTargetId] = {
      hash,
      updated_at: getManilaISOString(),
      updated_by: actingUser?.id || null
    };
    await writeCmsStore(MANAGER_PINS_STORE_KEY, "Manager PINs Store", map);
  });

  if (hasNativeUserPinCol !== false) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ pin_hash: hash })
        .eq("id", effectiveTargetId);
      if (error) {
        if (isMissingColumnError(error)) hasNativeUserPinCol = false;
      } else {
        hasNativeUserPinCol = true;
      }
    } catch (err) {
      if (isMissingColumnError(err)) hasNativeUserPinCol = false;
    }
  }

  await logAudit("MANAGER_PIN_UPDATED", actingUser?.id || null, {
    target_user_id: effectiveTargetId,
    updated_by: actingUser?.name || "Admin"
  });

  return { success: true, target_user_id: effectiveTargetId };
};

export const verifyManagerPin = async (pin, rateKey = "global") => {
  checkPinRateLimit(rateKey);

  const pinStr = String(pin ?? "").trim();
  if (!pinStr) {
    recordPinFailure(rateKey);
    throw createHttpError(403, "Manager PIN is required.");
  }

  const pinsMap = await readCmsStore(MANAGER_PINS_STORE_KEY, {});
  const configuredEntries = Object.entries(pinsMap || {}).filter(([, v]) => v && v.hash);
  if (configuredEntries.length === 0) {
    throw createHttpError(400, "No Manager PIN is configured. Set a Manager PIN in POS Settings first.");
  }

  for (const [uid, entry] of configuredEntries) {
    const matched = await bcrypt.compare(pinStr, entry.hash);
    if (matched) {
      const { data: userRow } = await supabase
        .from("users")
        .select("id, name, role")
        .eq("id", uid)
        .maybeSingle();
      clearPinFailures(rateKey);
      return {
        approved_by_id: userRow?.id || uid,
        approved_by_name: userRow?.name || "Manager",
        approved_by_role: userRow?.role || "Admin"
      };
    }
  }

  recordPinFailure(rateKey);
  throw createHttpError(403, "Invalid Manager PIN.");
};

const parseModifiersFromItem = (saleItem) => {
  if (saleItem?.modifiers && typeof saleItem.modifiers === "object") {
    return saleItem.modifiers;
  }
  const notes = String(saleItem?.notes || "");
  const match = notes.match(/Sugar:\s*(\d+%)/i);
  return match ? { sugar_level: match[1] } : null;
};

const parseOrderTypeFromSale = (sale, saleMeta) => {
  if (sale?.order_type) return String(sale.order_type).toUpperCase();
  if (saleMeta?.order_type) return String(saleMeta.order_type).toUpperCase();
  const notes = String(sale?.notes || "");
  if (/\[TAKE-OUT\]|\[TAKE_OUT\]/i.test(notes)) return "TAKE_OUT";
  if (/\[DELIVERY\]/i.test(notes)) return "DELIVERY";
  return "DINE_IN";
};

const computeEstimatedCostForIngredient = (ing, qty) => {
  const explicitUnitCost = parseFloat(ing?.unit_cost) || 0;
  if (explicitUnitCost > 0) return round2(explicitUnitCost * qty);
  const purchaseCost = parseFloat(ing?.cost_per_purchase_unit) || 0;
  const conv = parseFloat(ing?.conversion_factor) || 1;
  if (purchaseCost > 0 && conv > 0) return round2((purchaseCost / conv) * qty);
  const unit = String(ing?.unit || "").toUpperCase();
  const fallback = unit === "KG" || unit === "L" ? 180 : unit === "PCS" ? 2.5 : unit === "G" || unit === "ML" ? 0.22 : 1;
  return round2(qty * fallback);
};

export const voidOrRefundSale = async ({
  sale_id,
  action_type = "VOID",
  reason,
  restock_policy = "RESTOCK",
  manager_pin,
  requested_by_user
}) => {
  const actionType = String(action_type || "").trim().toUpperCase();
  if (!["VOID", "RETURN", "REFUND"].includes(actionType)) {
    throw createHttpError(400, "action_type must be VOID, RETURN, or REFUND.");
  }

  const cleanReason = validateTextLength(reason, {
    label: "Void/refund reason",
    min: 3,
    max: 300,
    required: true
  });

  const policy = String(restock_policy || "").trim().toUpperCase();
  if (!["RESTOCK", "WASTAGE"].includes(policy)) {
    throw createHttpError(400, "restock_policy must be RESTOCK or WASTAGE.");
  }

  const approval = await verifyManagerPin(manager_pin, requested_by_user?.id || "global");

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("*, sale_items(*, products(id, name, category, track_stock, stock_quantity, sizes, add_ons))")
    .eq("id", sale_id)
    .single();

  if (saleErr || !sale) {
    throw createHttpError(404, "Sale transaction not found.");
  }

  const [voidsMap, metaMap] = await Promise.all([getVoidRefundMap(), getSaleMetadataMap()]);
  const statusUpper = String(sale.status || "").toUpperCase();
  if (voidsMap[sale.id] || ["VOIDED", "REFUNDED", "RETURNED"].includes(statusUpper)) {
    throw createHttpError(409, "This transaction has already been voided or refunded.");
  }

  // Atomically claim the sale so concurrent voids cannot both restock.
  const claimedStatus = actionType === "VOID" ? "VOIDED" : actionType === "REFUND" ? "REFUNDED" : "RETURNED";
  let claimQuery = supabase.from("sales").update({ status: claimedStatus }).eq("id", sale.id);
  claimQuery = sale.status == null ? claimQuery.is("status", null) : claimQuery.eq("status", sale.status);
  const { data: claimed, error: claimErr } = await claimQuery.select("id");
  if (claimErr) throw claimErr;
  if (!claimed || claimed.length === 0) {
    throw createHttpError(409, "This transaction has already been voided or refunded.");
  }

  // Applied restocks, so a failure after the claim can be undone before the status is reverted.
  const appliedProductRestocks = [];
  const appliedRestockBatches = [];
  try {
  const saleItems = sale.sale_items || [];
  const productIds = [...new Set(saleItems.map((si) => si.product_id).filter(Boolean))];
  const orderType = parseOrderTypeFromSale(sale, metaMap[sale.id]);

  const [{ data: recipesRows }, { data: catSettings }, overridesMap] = await Promise.all([
    productIds.length > 0
      ? supabase.from("recipes").select("*, ingredients(*)").in("product_id", productIds)
      : Promise.resolve({ data: [] }),
    supabase.from("category_settings").select("category, sizes"),
    recipesService.getRecipeSizeOverridesMap()
  ]);

  const catSizesMap = new Map((catSettings || []).map((c) => [normalizeCategoryKey(c.category), c.sizes || []]));
  const recipesByProd = new Map();
  for (const r of recipesRows || []) {
    const ov = overridesMap[r.id];
    const enriched = {
      ...r,
      size_name: ov?.size_name ?? r.size_name ?? null,
      size_quantities: ov?.size_quantities ?? r.size_quantities ?? null
    };
    if (!recipesByProd.has(r.product_id)) recipesByProd.set(r.product_id, []);
    recipesByProd.get(r.product_id).push(enriched);
  }

  const productRestocks = {};
  const ingredientAmounts = {};
  const pendingAddonsByIng = {};

  for (const si of saleItems) {
    const prod = si.products;
    const itemQty = Number(si.quantity) || 0;
    if (!prod || itemQty <= 0) continue;

    if (prod.track_stock) {
      productRestocks[prod.id] = (productRestocks[prod.id] || 0) + itemQty;
      continue;
    }

    const sizesList = Array.isArray(prod.sizes) && prod.sizes.length > 0
      ? prod.sizes
      : (catSizesMap.get(normalizeCategoryKey(prod.category)) || []);
    const cupSizeObj = si.cup_size
      ? sizesList.find((s) => String(s?.name || "").trim().toLowerCase() === String(si.cup_size).trim().toLowerCase())
      : null;

    if (cupSizeObj) {
      for (const pkg of resolvePackagingIngredientIds(cupSizeObj, orderType)) {
        ingredientAmounts[pkg.ingredient_id] = (ingredientAmounts[pkg.ingredient_id] || 0) + itemQty;
      }
    }

    // Mirrors createSale: a product without a recipe had its own stock deducted.
    if ((recipesByProd.get(prod.id) || []).length === 0) {
      productRestocks[prod.id] = (productRestocks[prod.id] || 0) + itemQty;
    }

    const modifiers = parseModifiersFromItem(si);
    for (const recipe of recipesByProd.get(prod.id) || []) {
      const ing = recipe.ingredients;
      if (!ing) continue;
      const baseQty = recipesService.resolveRecipeQuantityForSize(recipe, si.cup_size, cupSizeObj);
      if (baseQty <= 0) continue;
      const scaled = baseQty * getSugarScaleMultiplier(modifiers, ing);
      if (scaled <= 0) continue;
      const baseUnitQty = convertToBaseUnit(scaled, recipe.recipe_unit || ing.unit, ing.unit);
      ingredientAmounts[ing.id] = (ingredientAmounts[ing.id] || 0) + baseUnitQty * itemQty;
    }

    if (Array.isArray(si.add_ons)) {
      for (const rawAo of si.add_ons) {
        const ao = parseAddOnEntry(rawAo);
        if (!ao?.ingredient_id) continue;
        const perAddonQty = Math.max(0, Number(ao.quantity) || 0);
        const aoQty = Math.max(0, parseInt(ao.customer_qty ?? ao.quantity ?? 1, 10) || 0);
        if (perAddonQty * aoQty <= 0) continue;
        if (!pendingAddonsByIng[ao.ingredient_id]) {
          pendingAddonsByIng[ao.ingredient_id] = [];
        }
        pendingAddonsByIng[ao.ingredient_id].push({ perAddonQty, aoQty, itemQty, unit: ao.unit });
      }
    }
  }

  const allIngIds = [...new Set([...Object.keys(ingredientAmounts), ...Object.keys(pendingAddonsByIng)])];
  const ingLookup = new Map();
  for (const r of recipesRows || []) {
    if (r.ingredients?.id) ingLookup.set(r.ingredients.id, r.ingredients);
  }
  if (allIngIds.length > 0) {
    const { data: fetchedIngs } = await supabase.from("ingredients").select("*").in("id", allIngIds);
    for (const ing of fetchedIngs || []) {
      ingLookup.set(ing.id, ing);
    }
  }

  // Resolve numeric ingredient amounts including add-on unit conversions
  const resolvedIngredients = {};
  for (const iid of allIngIds) {
    const ing = ingLookup.get(iid);
    if (!ing) continue;
    let qty = Number(ingredientAmounts[iid]) || 0;
    for (const a of pendingAddonsByIng[iid] || []) {
      const perUnit = convertToBaseUnit(a.perAddonQty, a.unit || ing.unit, ing.unit);
      qty += perUnit * a.itemQty * a.aoQty;
    }
    const rounded = round6(qty);
    if (rounded > 0) {
      resolvedIngredients[iid] = { ing, qty: rounded };
    }
  }

  if (policy === "RESTOCK") {
    for (const [pid, qty] of Object.entries(productRestocks)) {
      // Relative compare-and-set increment (same path as sale deduction), clamped to the stock cap.
      const { prev, next } = await adjustProductStock(pid, qty, { max: LIMITS.STOCK_QTY_MAX });
      appliedProductRestocks.push({ pid, qty: round6(next - prev) });
    }

    // Prefer returning stock to the exact lots checkout drew from (audit written at checkout).
    const { data: deductAudits, error: auditErr } = await supabase
      .from("audit_logs")
      .select("new_value")
      .eq("action", "INGREDIENT_DEDUCTED")
      .eq("new_value->>sale_id", String(sale.id));
    if (auditErr) console.error("[POS Void] Audit lookup failed, using new-lot fallback:", auditErr.message);
    const restoredIids = new Set();
    for (const row of deductAudits || []) {
      const d = row.new_value || {};
      const lots = Array.isArray(d.deducted_batches) ? d.deducted_batches : [];
      if (!d.ingredient_id || lots.length === 0 || restoredIids.has(d.ingredient_id)) continue;
      await batchService.restoreDeductedBatches(d.ingredient_id, lots);
      restoredIids.add(d.ingredient_id);
      for (const l of lots) {
        appliedRestockBatches.push({ iid: d.ingredient_id, batch_id: l.batch_id, qty: l.quantity_deducted });
      }
    }

    for (const [iid, entry] of Object.entries(resolvedIngredients)) {
      if (restoredIids.has(iid)) continue;
      // One insert; the inventory_batches trigger raises the ingredient total.
      const batch = await batchService.createBatch({
        ingredient_id: iid,
        source: "VOID_RESTOCK",
        initial_quantity: entry.qty,
        notes: `${actionType} of ${sale.receipt_number || sale.id}: ${cleanReason}`
      });
      appliedRestockBatches.push({ iid, batch_id: batch.id, qty: entry.qty });
    }
  } else {
    // Wastage policy: record wastage entries without restoring usable stock.
    const wastageRows = Object.entries(resolvedIngredients).map(([iid, entry]) => ({
      ingredient_id: iid,
      quantity: entry.qty,
      reason: `[${actionType}] ${cleanReason}`,
      reported_by: requested_by_user?.id || null,
      estimated_cost: computeEstimatedCostForIngredient(entry.ing, entry.qty)
    }));
    if (wastageRows.length > 0) {
      const { error: wasteErr } = await supabase.from("wastage").insert(wastageRows);
      if (wasteErr) throw wasteErr;
    }
  }
  } catch (restockErr) {
    // Compensate: undo applied restocks, then release the claim so the void can be retried.
    const undo = await Promise.allSettled([
      ...appliedProductRestocks.map((r) => adjustProductStock(r.pid, -r.qty)),
      ...appliedRestockBatches.map((b) =>
        batchService.deductStockFEFO(b.iid, b.qty, { targetBatchId: b.batch_id, allowExpired: true })
      )
    ]);
    const undoFailed = undo.filter((r) => r.status === "rejected");
    undoFailed.forEach((r) => console.error("[POS Void] Restock compensation failed for sale", sale.id, r.reason));
    if (undoFailed.length === 0) {
      const { error: revertErr } = await supabase
        .from("sales")
        .update({ status: sale.status })
        .eq("id", sale.id)
        .eq("status", claimedStatus);
      if (revertErr) console.error("[POS Void] Failed to revert claimed status for sale", sale.id, revertErr);
    }
    // If an undo failed, the sale stays claimed so a retry cannot restock twice; stock needs a manual check.
    throw restockErr;
  }

  const nextSaleStatus = actionType === "VOID" ? "VOIDED" : actionType === "REFUND" ? "REFUNDED" : "RETURNED";
  const voidRecord = {
    id: crypto.randomUUID(),
    sale_id: sale.id,
    receipt_number: sale.receipt_number || null,
    action_type: actionType,
    status: nextSaleStatus,
    reason: cleanReason,
    restock_policy: policy,
    amount_voided: round2(sale.total_amount),
    approved_by_id: approval.approved_by_id,
    approved_by_name: approval.approved_by_name,
    approved_by_role: approval.approved_by_role,
    requested_by_id: requested_by_user?.id || null,
    requested_by_name: requested_by_user?.name || "Staff",
    created_at: getManilaISOString()
  };

  await withStoreLock(VOIDS_STORE_KEY, async () => {
    const map = await readCmsStore(VOIDS_STORE_KEY, {});
    map[sale.id] = voidRecord;
    await writeCmsStore(VOIDS_STORE_KEY, "POS Voids and Refunds Store", map);
  });

  if (hasNativeSaleVoidsTable !== false) {
    try {
      const { error } = await supabase.from("sale_voids").insert([
        {
          id: voidRecord.id,
          sale_id: voidRecord.sale_id,
          action_type: voidRecord.action_type,
          reason: voidRecord.reason,
          restock_policy: voidRecord.restock_policy,
          amount_voided: voidRecord.amount_voided,
          approved_by_id: voidRecord.approved_by_id,
          approved_by_name: voidRecord.approved_by_name,
          requested_by_id: voidRecord.requested_by_id,
          requested_by_name: voidRecord.requested_by_name,
          created_at: voidRecord.created_at
        }
      ]);
      if (error) {
        if (isMissingTableError(error)) hasNativeSaleVoidsTable = false;
        else throw error;
      } else {
        hasNativeSaleVoidsTable = true;
      }
    } catch (err) {
      if (isMissingTableError(err)) hasNativeSaleVoidsTable = false;
      else throw err;
    }
  }

  // Cancel any matching KDS ticket; non-fatal because the sale is already voided.
  try {
  await withStoreLock(KDS_STORE_KEY, async () => {
    const store = await readCmsStore(KDS_STORE_KEY, { tickets: [] });
    const tickets = Array.isArray(store.tickets) ? store.tickets : [];
    let changed = false;
    for (const t of tickets) {
      if (String(t.sale_id) === String(sale.id) && t.status !== "CANCELLED") {
        t.status = "CANCELLED";
        t.updated_at = getManilaISOString();
        changed = true;
      }
    }
    if (changed) {
      await writeCmsStore(KDS_STORE_KEY, "POS KDS Queue Store", { tickets });
    }
  });
  } catch (kdsErr) {
    console.error("Failed to cancel KDS ticket for voided sale", sale.id, kdsErr);
  }

  const auditAction = actionType === "VOID" ? "SALE_VOIDED" : "SALE_REFUNDED";
  await Promise.all([
    logAudit(auditAction, requested_by_user?.id || null, {
      sale_id: sale.id,
      receipt_number: sale.receipt_number || null,
      action_type: actionType,
      restock_policy: policy,
      reason: cleanReason,
      amount_voided: voidRecord.amount_voided,
      approved_by_id: approval.approved_by_id,
      approved_by_name: approval.approved_by_name
    }),
    logAudit("PIN_OVERRIDE_APPROVED", requested_by_user?.id || null, {
      sale_id: sale.id,
      action_type: actionType,
      approved_by_id: approval.approved_by_id,
      approved_by_name: approval.approved_by_name,
      approved_by_role: approval.approved_by_role
    })
  ]);

  return voidRecord;
};

/**
 * Pure X-Reading / Z-Reading aggregator (testable without DB).
 */
export const aggregateShiftReading = ({
  shift = null,
  sales = [],
  voidsMap = {},
  metaMap = {},
  windowStart = null,
  windowEnd = null
}) => {
  const openingCash = round2(shift?.opening_cash || 0);
  let grossSales = 0;
  let netSales = 0;
  let totalDiscounts = 0;
  let cashSales = 0;
  let gcashSales = 0;
  let mayaSales = 0;
  let cardSales = 0;
  let qrphSales = 0;
  let transactionCount = 0;
  let voidedCount = 0;
  let voidedAmount = 0;

  for (const sale of sales || []) {
    const amount = round2(sale.total_amount || 0);
    const discount = round2(sale.discount_amount || 0);
    const statusUpper = String(sale.status || "").toUpperCase();
    const isVoided = Boolean(voidsMap[sale.id]) || ["VOIDED", "REFUNDED", "RETURNED"].includes(statusUpper);

    if (isVoided) {
      voidedCount += 1;
      voidedAmount = round2(voidedAmount + amount);
      continue;
    }

    transactionCount += 1;
    netSales = round2(netSales + amount);
    totalDiscounts = round2(totalDiscounts + discount);
    grossSales = round2(grossSales + amount + discount);

    const meta = metaMap[sale.id];
    const changeAmt = round2(sale.change_amount || 0);
    if (Array.isArray(meta?.payments) && meta.payments.length > 0) {
      for (const leg of meta.payments) {
        const m = String(leg.method || "").toUpperCase();
        const legAmt = round2(leg.amount || 0);
        if (m === "CASH") {
          cashSales = round2(cashSales + Math.max(0, round2(legAmt - changeAmt)));
        } else if (m === "GCASH") {
          gcashSales = round2(gcashSales + legAmt);
        } else if (m === "MAYA") {
          mayaSales = round2(mayaSales + legAmt);
        } else if (m === "CARD") {
          cardSales = round2(cardSales + legAmt);
        } else if (m === "QRPH") {
          qrphSales = round2(qrphSales + legAmt);
        }
      }
    } else {
      const m = String(sale.payment_method || "CASH").toUpperCase();
      if (m === "CASH") cashSales = round2(cashSales + amount);
      else if (m === "GCASH") gcashSales = round2(gcashSales + amount);
      else if (m === "MAYA") mayaSales = round2(mayaSales + amount);
      else if (m === "CARD") cardSales = round2(cardSales + amount);
      else if (m === "QRPH") qrphSales = round2(qrphSales + amount);
      else cashSales = round2(cashSales + amount);
    }
  }

  const expectedDrawerCash = round2(openingCash + cashSales);
  return {
    shift_id: shift?.id || null,
    shift_status: shift?.status || "NO_ACTIVE_SHIFT",
    cashier_name: shift?.cashier_name || null,
    opened_at: shift?.opened_at || windowStart,
    closed_at: shift?.closed_at || windowEnd || null,
    opening_cash: openingCash,
    transaction_count: transactionCount,
    gross_sales: grossSales,
    total_discounts: totalDiscounts,
    net_sales: netSales,
    cash_sales: cashSales,
    gcash_sales: gcashSales,
    maya_sales: mayaSales,
    card_sales: cardSales,
    qrph_sales: qrphSales,
    voided_count: voidedCount,
    voided_amount: voidedAmount,
    expected_drawer_cash: expectedDrawerCash
  };
};

export const getCurrentShift = async (userId) => {
  const store = await readCmsStore(SHIFTS_STORE_KEY, { shifts: [] });
  const shifts = Array.isArray(store.shifts) ? store.shifts : [];
  return shifts.find((s) => s.status === "OPEN" && (!userId || String(s.cashier_id) === String(userId))) || null;
};

export const getShiftHistory = async () => {
  const store = await readCmsStore(SHIFTS_STORE_KEY, { shifts: [] });
  return Array.isArray(store.shifts) ? store.shifts : [];
};

export const openShift = async ({ opening_cash = 0, notes = "", user }) => {
  const openingCash = round2(
    validateNumberBound(opening_cash, {
      label: "Opening cash",
      min: 0,
      max: 1000000
    })
  );
  const cleanNotes = validateTextLength(notes, {
    label: "Shift notes",
    min: 0,
    max: 300,
    required: false
  });

  const shift = await withStoreLock(SHIFTS_STORE_KEY, async () => {
    const store = await readCmsStore(SHIFTS_STORE_KEY, { shifts: [] });
    const shifts = Array.isArray(store.shifts) ? store.shifts : [];
    const existingOpen = shifts.find((s) => s.status === "OPEN" && String(s.cashier_id) === String(user?.id));
    if (existingOpen) {
      throw createHttpError(409, "You already have an open shift. Close it before opening a new one.");
    }

    const newShift = {
      id: crypto.randomUUID(),
      cashier_id: user?.id || null,
      cashier_name: user?.name || "Staff",
      status: "OPEN",
      opening_cash: openingCash,
      notes: cleanNotes || "",
      opened_at: getManilaISOString(),
      closed_at: null
    };
    const updated = [newShift, ...shifts].slice(0, MAX_SHIFTS_HISTORY);
    await writeCmsStore(SHIFTS_STORE_KEY, "POS Shifts Store", { shifts: updated });
    return newShift;
  });

  if (hasNativePosShiftsTable !== false) {
    try {
      const { error } = await supabase.from("pos_shifts").insert([
        {
          id: shift.id,
          cashier_id: shift.cashier_id,
          cashier_name: shift.cashier_name,
          status: shift.status,
          opening_cash: shift.opening_cash,
          notes: shift.notes || null,
          opened_at: shift.opened_at
        }
      ]);
      if (error) {
        if (isMissingTableError(error)) hasNativePosShiftsTable = false;
      } else {
        hasNativePosShiftsTable = true;
      }
    } catch (err) {
      if (isMissingTableError(err)) hasNativePosShiftsTable = false;
    }
  }

  await logAudit("SHIFT_OPENED", user?.id || null, {
    shift_id: shift.id,
    opening_cash: shift.opening_cash,
    cashier_name: shift.cashier_name
  });

  return shift;
};

const SHIFT_MANAGER_ROLES = ["Admin", "Owner"];
const isShiftManager = (user) => SHIFT_MANAGER_ROLES.includes(user?.role);

// Only the shift's own cashier, or Admin/Owner, may read or close it.
export const assertCanAccessShift = (shift, user) => {
  if (shift && !isShiftManager(user) && String(shift.cashier_id) !== String(user?.id)) {
    throw createHttpError(403, "You can only access your own shift.");
  }
};

export const computeXReading = async ({ shift_id = null, user = null } = {}) => {
  const store = await readCmsStore(SHIFTS_STORE_KEY, { shifts: [] });
  const shifts = Array.isArray(store.shifts) ? store.shifts : [];

  let targetShift = null;
  if (shift_id) {
    targetShift = shifts.find((s) => String(s.id) === String(shift_id)) || null;
  } else if (user?.id) {
    targetShift = shifts.find((s) => s.status === "OPEN" && String(s.cashier_id) === String(user.id)) || null;
  }
  if (!targetShift && !shift_id && isShiftManager(user)) {
    targetShift = shifts.find((s) => s.status === "OPEN") || null;
  }
  assertCanAccessShift(targetShift, user);

  const windowStart = targetShift?.opened_at || toManilaStartOfDay(getManilaDateOnly());
  const windowEnd = targetShift?.closed_at || null;

  let query = supabase
    .from("sales")
    .select("id, total_amount, discount_amount, payment_method, change_amount, status, created_at")
    .gte("created_at", windowStart);
  if (windowEnd) {
    query = query.lte("created_at", windowEnd);
  }
  // A reading covers only its cashier's sales (sales.staff_id is set by createSale); managers
  // without a shift see the whole store.
  const staffFilter = targetShift?.cashier_id || (isShiftManager(user) ? null : user?.id);
  if (staffFilter) {
    query = query.eq("staff_id", staffFilter);
  }

  const [{ data: sales, error }, voidsMap, metaMap] = await Promise.all([
    query,
    getVoidRefundMap(),
    getSaleMetadataMap()
  ]);
  if (error) throw error;

  return aggregateShiftReading({
    shift: targetShift,
    sales: sales || [],
    voidsMap,
    metaMap,
    windowStart,
    windowEnd
  });
};

export const closeShiftZReading = async ({ shift_id = null, actual_cash_counted, notes = "", user }) => {
  const counted = round2(
    validateNumberBound(actual_cash_counted, {
      label: "Actual cash counted",
      min: 0,
      max: 1000000
    })
  );
  const cleanNotes = validateTextLength(notes, {
    label: "Shift closing notes",
    min: 0,
    max: 300,
    required: false
  });

  const store = await readCmsStore(SHIFTS_STORE_KEY, { shifts: [] });
  const shifts = Array.isArray(store.shifts) ? store.shifts : [];

  const targetShift = shift_id
    ? shifts.find((s) => String(s.id) === String(shift_id))
    : shifts.find((s) => s.status === "OPEN" && String(s.cashier_id) === String(user?.id)) ||
      (isShiftManager(user) ? shifts.find((s) => s.status === "OPEN") : null);

  if (!targetShift) {
    throw createHttpError(404, "No open shift found to close.");
  }
  assertCanAccessShift(targetShift, user);
  if (targetShift.status === "CLOSED") {
    throw createHttpError(409, "This shift has already been closed.");
  }

  const xReading = await computeXReading({ shift_id: targetShift.id, user });
  const shortOver = round2(counted - xReading.expected_drawer_cash);
  const closedAt = getManilaISOString();

  const closedShift = await withStoreLock(SHIFTS_STORE_KEY, async () => {
    const latestStore = await readCmsStore(SHIFTS_STORE_KEY, { shifts: [] });
    const latestShifts = Array.isArray(latestStore.shifts) ? latestStore.shifts : [];
    const idx = latestShifts.findIndex((s) => String(s.id) === String(targetShift.id));
    if (idx === -1) throw createHttpError(404, "Shift not found.");
    // Re-check under the lock so two concurrent Z-closes cannot both close (and overwrite) the shift.
    if (latestShifts[idx].status !== "OPEN") {
      throw createHttpError(409, "This shift has already been closed.");
    }

    const updatedShift = {
      ...latestShifts[idx],
      status: "CLOSED",
      closed_at: closedAt,
      closed_by: user?.id || null,
      closed_by_name: user?.name || "Staff",
      actual_cash_counted: counted,
      expected_drawer_cash: xReading.expected_drawer_cash,
      short_over: shortOver,
      closing_notes: cleanNotes || "",
      summary: {
        ...xReading,
        closed_at: closedAt,
        actual_cash_counted: counted,
        short_over: shortOver
      }
    };
    latestShifts[idx] = updatedShift;
    await writeCmsStore(SHIFTS_STORE_KEY, "POS Shifts Store", { shifts: latestShifts });
    return updatedShift;
  });

  if (hasNativePosShiftsTable !== false) {
    try {
      const { error } = await supabase
        .from("pos_shifts")
        .update({
          status: "CLOSED",
          closed_at: closedAt,
          closed_by: user?.id || null,
          actual_cash_counted: counted,
          expected_drawer_cash: xReading.expected_drawer_cash,
          short_over: shortOver,
          summary: closedShift.summary
        })
        .eq("id", closedShift.id)
        .eq("status", "OPEN");
      if (error && isMissingTableError(error)) {
        hasNativePosShiftsTable = false;
      }
    } catch (err) {
      if (isMissingTableError(err)) hasNativePosShiftsTable = false;
    }
  }

  await logAudit("SHIFT_Z_READING_CLOSED", user?.id || null, {
    shift_id: closedShift.id,
    expected_drawer_cash: xReading.expected_drawer_cash,
    actual_cash_counted: counted,
    short_over: shortOver,
    net_sales: xReading.net_sales,
    voided_count: xReading.voided_count
  });

  return closedShift;
};

const KITCHEN_STATION_PATTERN =
  /PASTRY|PASTRIES|PASTA|SPAGHETTI|CARBONARA|LASAGNA|MACARONI|PENNE|FETTUCCINE|NOODLE|RAMEN|PANCIT|FOOD|MEAL|RICE|SILOG|BREAKFAST|LUNCH|DINNER|SNACK|SANDWICH|BURGER|PIZZA|CAKE|WAFFLE|CROFFLE|BREAD|TOAST|BAGEL|PANINI|COOKIE|BROWNIE|MUFFIN|CUPCAKE|DONUT|CROISSANT|PIE|TART|PUDDING|FRIES|NACHOS|WINGS|CHICKEN|PORK|BEEF|FISH|SEAFOOD|SAUSAGE|HOTDOG|BACON|HAM|EGG|OMELET|SALAD|SOUP|STEAK|RIBS|SISIG|LUMPIA|DIMSUM|SIOMAI|EMPANADA|QUESADILLA|TACO|BURRITO|WRAP|DESSERT|PLATTER|COMBO|SOLO|SIDE|APPETIZER|STARTER|BENTO|BOWL/i;
const BARISTA_STATION_PATTERN =
  /COFFEE|ESPRESSO|LATTE|CAPPUCCINO|MACCHIATO|MOCHA|AMERICANO|COLD BREW|BREW|FRAPPE|FRAPPUCCINO|SMOOTHIE|SHAKE|MILKSHAKE|TEA|MILK TEA|MATCHA|HOJICHA|CHAI|FRUIT TEA|ICED TEA|LEMONADE|SODA|SPARKLING|FIZZ|JUICE|DRINK|BEVERAGE|CHOCOLATE|COCOA|MILO|HORCHATA|YOGURT|YAKULT|FLOAT|AFFOGATO|REFRESH|COOLER/i;

export const classifyKdsStation = (input = "", maybeName = "") => {
  const opts =
    input && typeof input === "object" && !Array.isArray(input)
      ? input
      : { category: input, name: maybeName };

  const explicit = String(opts.prep_station || "").trim().toUpperCase();
  if (explicit === "BARISTA" || explicit === "KITCHEN") {
    return explicit;
  }

  const catStr = String(opts.category || "").trim();
  const catKey = normalizeCategoryKey(catStr);
  if (catKey && opts.categoryStationMap) {
    const mapped =
      opts.categoryStationMap instanceof Map
        ? opts.categoryStationMap.get(catKey)
        : opts.categoryStationMap[catKey];
    const mappedUpper = String(mapped || "").trim().toUpperCase();
    if (mappedUpper === "BARISTA" || mappedUpper === "KITCHEN") {
      return mappedUpper;
    }
  }

  const nameStr = String(opts.name || "").trim();
  if (KITCHEN_STATION_PATTERN.test(catStr)) return "KITCHEN";
  if (BARISTA_STATION_PATTERN.test(catStr)) return "BARISTA";
  if (KITCHEN_STATION_PATTERN.test(nameStr)) return "KITCHEN";
  if (BARISTA_STATION_PATTERN.test(nameStr)) return "BARISTA";

  if (opts.cup_size || (Array.isArray(opts.sizes) && opts.sizes.length > 0)) {
    return "BARISTA";
  }
  if (opts.track_stock === true) {
    return "KITCHEN";
  }
  return catStr && !opts.name ? "BARISTA" : "KITCHEN";
};

export const buildKdsTicketFromOrder = ({
  sale,
  cart = [],
  order_type = "DINE_IN",
  productCategoryMap = new Map(),
  productMetaMap = new Map(),
  categoryStationMap = null
}) => {
  const items = (cart || []).map((item) => {
    const prodMeta = productMetaMap.get(String(item.id)) || null;
    const category = item.category || prodMeta?.category || productCategoryMap.get(String(item.id)) || "";
    const sizes = Array.isArray(item.sizes) && item.sizes.length > 0 ? item.sizes : prodMeta?.sizes;
    const trackStock = item.track_stock ?? prodMeta?.track_stock;
    return {
      product_id: item.id,
      name: item.name || "Item",
      category: category || null,
      qty: Number(item.qty ?? item.quantity) || 1,
      cup_size: item.cup_size || null,
      modifiers: item.modifiers || null,
      add_ons: Array.isArray(item.add_ons)
        ? item.add_ons.map((ao) => ({ name: ao?.name || ao, customer_qty: ao?.customer_qty ?? ao?.quantity ?? 1 }))
        : [],
      station: classifyKdsStation({
        category,
        name: item.name,
        prep_station: item.prep_station || prodMeta?.prep_station,
        cup_size: item.cup_size,
        sizes,
        track_stock: trackStock,
        categoryStationMap
      })
    };
  });

  const stations = [...new Set(items.map((i) => i.station))];
  const nowIso = getManilaISOString();

  return {
    id: crypto.randomUUID(),
    sale_id: sale?.id || null,
    receipt_number: sale?.receipt_number || null,
    order_type: order_type || "DINE_IN",
    status: "PENDING",
    items,
    stations,
    created_at: nowIso,
    updated_at: nowIso
  };
};

export const enqueueKdsOrder = async ({ sale, cart = [], order_type = "DINE_IN" }) => {
  const productIds = [...new Set((cart || []).map((i) => i?.id).filter(Boolean))];
  const productCategoryMap = new Map();
  const productMetaMap = new Map();

  const [prodsRes, categoryStationMap] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("id, category, sizes, track_stock").in("id", productIds)
      : Promise.resolve({ data: [] }),
    readCmsStore(CATEGORY_STATIONS_STORE_KEY, {})
  ]);

  for (const p of prodsRes?.data || []) {
    productCategoryMap.set(String(p.id), p.category);
    productMetaMap.set(String(p.id), p);
  }

  const ticket = buildKdsTicketFromOrder({
    sale,
    cart,
    order_type,
    productCategoryMap,
    productMetaMap,
    categoryStationMap
  });

  await withStoreLock(KDS_STORE_KEY, async () => {
    const store = await readCmsStore(KDS_STORE_KEY, { tickets: [] });
    const tickets = Array.isArray(store.tickets) ? store.tickets : [];
    const updated = [ticket, ...tickets].slice(0, MAX_KDS_TICKETS);
    await writeCmsStore(KDS_STORE_KEY, "POS KDS Queue Store", { tickets: updated });
  });

  if (hasNativeKdsTicketsTable !== false) {
    try {
      const { error } = await supabase.from("kds_tickets").insert([
        {
          id: ticket.id,
          sale_id: ticket.sale_id,
          receipt_number: ticket.receipt_number,
          order_type: ticket.order_type,
          status: ticket.status,
          items: ticket.items,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at
        }
      ]);
      if (error) {
        if (isMissingTableError(error)) hasNativeKdsTicketsTable = false;
      } else {
        hasNativeKdsTicketsTable = true;
      }
    } catch (err) {
      if (isMissingTableError(err)) hasNativeKdsTicketsTable = false;
    }
  }

  return ticket;
};

export const getKdsQueue = async ({ station = "ALL", includeServed = false } = {}) => {
  const [store, categoryStationMap] = await Promise.all([
    readCmsStore(KDS_STORE_KEY, { tickets: [] }),
    readCmsStore(CATEGORY_STATIONS_STORE_KEY, {})
  ]);
  let tickets = Array.isArray(store.tickets) ? store.tickets : [];

  const referencedProductIds = [
    ...new Set(
      tickets.flatMap((t) =>
        Array.isArray(t.items) ? t.items.map((it) => it?.product_id).filter(Boolean) : []
      )
    )
  ];

  const productMetaMap = new Map();
  if (referencedProductIds.length > 0) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, category, sizes, track_stock")
      .in("id", referencedProductIds);
    for (const p of prods || []) {
      productMetaMap.set(String(p.id), p);
    }
  }

  let anyReclassified = false;
  const normalizedTickets = tickets.map((t) => {
    const rawItems = Array.isArray(t.items) ? t.items : [];
    let ticketChanged = false;
    const updatedItems = rawItems.map((it) => {
      const prodMeta = it?.product_id ? productMetaMap.get(String(it.product_id)) : null;
      const category = it.category || prodMeta?.category || "";
      const nextStation = classifyKdsStation({
        category,
        name: it.name,
        prep_station: it.prep_station || prodMeta?.prep_station,
        cup_size: it.cup_size,
        sizes: prodMeta?.sizes,
        track_stock: prodMeta?.track_stock,
        categoryStationMap
      });
      if (nextStation !== it.station || (category && !it.category)) {
        ticketChanged = true;
        anyReclassified = true;
        return {
          ...it,
          ...(category ? { category } : {}),
          station: nextStation
        };
      }
      return it;
    });

    if (!ticketChanged) return t;
    return {
      ...t,
      items: updatedItems,
      stations: [...new Set(updatedItems.map((i) => i.station))]
    };
  });

  if (anyReclassified) {
    await withStoreLock(KDS_STORE_KEY, async () => {
      const latestStore = await readCmsStore(KDS_STORE_KEY, { tickets: [] });
      const latestTickets = Array.isArray(latestStore.tickets) ? latestStore.tickets : [];
      const reclassifiedLatest = latestTickets.map((t) => {
        const match = normalizedTickets.find((nt) => nt.id === t.id);
        return match ? { ...t, items: match.items, stations: match.stations } : t;
      });
      await writeCmsStore(KDS_STORE_KEY, "POS KDS Queue Store", { tickets: reclassifiedLatest });
    });
  }

  tickets = normalizedTickets;
  if (!includeServed) {
    tickets = tickets.filter((t) => !["SERVED", "CANCELLED"].includes(String(t.status || "").toUpperCase()));
  }

  const stUpper = String(station || "ALL").trim().toUpperCase();
  if (stUpper === "BARISTA" || stUpper === "KITCHEN") {
    tickets = tickets
      .filter((t) => Array.isArray(t.items) && t.items.some((i) => i.station === stUpper))
      .map((t) => ({
        ...t,
        items: t.items.filter((i) => i.station === stUpper)
      }));
  }

  return tickets;
};

export const updateKdsTicketStatus = async (ticketId, status, user) => {
  const nextStatus = String(status || "").trim().toUpperCase();
  if (!ALLOWED_KDS_STATUSES.includes(nextStatus)) {
    throw createHttpError(400, `Invalid KDS status. Must be one of: ${ALLOWED_KDS_STATUSES.join(", ")}.`);
  }

  const updatedTicket = await withStoreLock(KDS_STORE_KEY, async () => {
    const store = await readCmsStore(KDS_STORE_KEY, { tickets: [] });
    const tickets = Array.isArray(store.tickets) ? store.tickets : [];
    const idx = tickets.findIndex((t) => String(t.id) === String(ticketId));
    if (idx === -1) {
      throw createHttpError(404, "KDS ticket not found.");
    }
    const next = {
      ...tickets[idx],
      status: nextStatus,
      updated_at: getManilaISOString(),
      updated_by: user?.id || null
    };
    tickets[idx] = next;
    await writeCmsStore(KDS_STORE_KEY, "POS KDS Queue Store", { tickets });
    return next;
  });

  if (hasNativeKdsTicketsTable !== false) {
    try {
      const { error } = await supabase
        .from("kds_tickets")
        .update({ status: nextStatus, updated_at: updatedTicket.updated_at })
        .eq("id", ticketId);
      if (error && isMissingTableError(error)) {
        hasNativeKdsTicketsTable = false;
      }
    } catch (err) {
      if (isMissingTableError(err)) hasNativeKdsTicketsTable = false;
    }
  }

  return updatedTicket;
};

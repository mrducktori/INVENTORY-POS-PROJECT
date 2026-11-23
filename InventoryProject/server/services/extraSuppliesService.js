import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { validateTextLength } from "../utils/validationHelper.js";
import { invalidateAnalyticsCache } from "../routes/analytics.js";
import * as batchService from "./batchService.js";

// Word boundary so "STRAWBERRY SYRUP" does not match.
export const isStrawName = (name) => /\bstraws?\b/i.test(String(name ?? ""));

const fail = (status, message) => Object.assign(new Error(message), { status });

/** Whole number 1..5; undefined/null defaults to 1. */
export const validateExtraQuantity = (value) => {
  if (value === undefined || value === null || value === "") return 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw fail(400, "Quantity must be a whole number from 1 to 5.");
  return n;
};

export const listExtraSupplies = async () => {
  const { data, error } = await supabase.from("ingredients").select("*").neq("is_archived", true).order("name");
  if (error) throw error;
  const straws = (data || []).filter((i) => isStrawName(i.name));
  const enriched = await batchService.enrichIngredientsWithBatches(straws);
  return enriched.map((i) => ({
    ingredient_id: i.id,
    name: i.name,
    unit: i.unit,
    usable_stock: Number(i.usable_stock || 0)
  }));
};

export const useExtraSupply = async ({ ingredient_id, quantity, note }, userId) => {
  if (!ingredient_id) throw fail(400, "ingredient_id is required.");
  const qty = validateExtraQuantity(quantity);
  const cleanNote = validateTextLength(note, { label: "Note", min: 1, max: 120, required: false });

  const { data: ing, error } = await supabase
    .from("ingredients")
    .select("id, name, unit, is_archived")
    .eq("id", ingredient_id)
    .maybeSingle();
  if (error) throw error;
  if (!ing) throw fail(404, "Ingredient not found.");
  if (ing.is_archived || !isStrawName(ing.name)) throw fail(400, "Only straw supplies can be given out this way");

  const result = await batchService.deductStockFEFO(ing.id, qty, { allowExpired: false });

  await logAudit("INGREDIENT_DEDUCTED", userId, {
    ingredient_id: ing.id,
    name: ing.name,
    quantity: -qty,
    new_stock: result.newTotalStock,
    deducted_batches: result.deductedBatches,
    type: "EXTRA_SUPPLY",
    note: cleanNote || null
  });
  invalidateAnalyticsCache();

  return { success: true, ingredient_id: ing.id, name: ing.name, unit: ing.unit, quantity: qty, new_stock: result.newTotalStock };
};

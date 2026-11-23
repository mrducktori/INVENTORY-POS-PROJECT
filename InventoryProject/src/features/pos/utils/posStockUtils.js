import { convertToBaseUnit } from "../../../utils/productUtils.js";

export const MAX_LINE_QTY = 99;
export const MAX_ADDON_QTY = 5;
export const STOCK_EPSILON = 1e-9;

export const normalizeSizeKey = (s) =>
  String(s || "").trim().replace(/\s+/g, "").toLowerCase();

export const isSweetenerIngredient = (ing) => {
  if (!ing) return false;
  const nameMatch = /SUGAR|FRUCTOSE|SWEETENER/i.test(String(ing.name || ""));
  const catMatch = String(ing.category || "").trim().toUpperCase() === "SWEETENERS & SYRUPS";
  return nameMatch || catMatch;
};

export const getSugarScaleFactor = (modifiers) => {
  const level = String(modifiers?.sugar_level || "").trim();
  if (!level) return 1;
  const map = { "0%": 0, "25%": 0.25, "50%": 0.5, "75%": 0.75, "100%": 1 };
  if (Object.prototype.hasOwnProperty.call(map, level)) return map[level];
  const parsed = parseFloat(level.replace("%", ""));
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 200) return parsed / 100;
  return 1;
};

const getUsableStock = (ing) => {
  if (!ing) return 0;
  const raw =
    ing.usable_stock !== undefined && ing.usable_stock !== null
      ? ing.usable_stock
      : ing.stock_quantity;
  return Math.max(0, parseFloat(raw) || 0);
};

export const resolveRecipeQuantityForSize = (recipe, cupSizeName, cupSizeObj = null) => {
  if (!recipe) return 0;
  const normTarget = normalizeSizeKey(cupSizeName);

  if (recipe.size_quantities && typeof recipe.size_quantities === "object" && normTarget) {
    for (const [key, val] of Object.entries(recipe.size_quantities)) {
      if (normalizeSizeKey(key) === normTarget) {
        const num = Number(val);
        if (Number.isFinite(num) && num >= 0) {
          return num;
        }
      }
    }
  }

  if (recipe.size_name) {
    const normRecipeSize = normalizeSizeKey(recipe.size_name);
    if (normRecipeSize && normRecipeSize !== "all") {
      return normRecipeSize === normTarget ? (parseFloat(recipe.quantity_used) || 0) : 0;
    }
  }

  const baseQty = parseFloat(recipe.quantity_used) || 0;
  const mult = parseFloat(cupSizeObj?.recipe_multiplier);
  return baseQty * (Number.isFinite(mult) && mult > 0 ? mult : 1);
};

export const buildRecipesByProductMap = (recipes = []) => {
  const map = {};
  (recipes || []).forEach((recipe) => {
    if (!recipe?.product_id) return;
    if (!map[recipe.product_id]) map[recipe.product_id] = [];
    map[recipe.product_id].push(recipe);
  });
  return map;
};

export const buildIngredientsMap = (ingredients = []) => {
  const map = {};
  (ingredients || []).forEach((ing) => {
    if (ing?.id) map[ing.id] = ing;
  });
  return map;
};

const parseAddOnEntry = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const accumulatePackagingUsage = (reservedIngredients, cupSizeObj, qty, orderType, ingredientsMap) => {
  if (!cupSizeObj || qty <= 0) return;
  const normOrderType = String(orderType || "DINE_IN").toUpperCase();
  const skipCup = normOrderType === "DINE_IN" && Boolean(cupSizeObj.dine_in_no_cup);

  if (!skipCup && cupSizeObj.ingredient_id && ingredientsMap[cupSizeObj.ingredient_id]) {
    reservedIngredients[cupSizeObj.ingredient_id] =
      (reservedIngredients[cupSizeObj.ingredient_id] || 0) + qty;
  }

  if (normOrderType === "TAKE_OUT" || normOrderType === "DELIVERY") {
    if (cupSizeObj.lid_ingredient_id && ingredientsMap[cupSizeObj.lid_ingredient_id]) {
      reservedIngredients[cupSizeObj.lid_ingredient_id] =
        (reservedIngredients[cupSizeObj.lid_ingredient_id] || 0) + qty;
    }
    if (cupSizeObj.straw_ingredient_id && ingredientsMap[cupSizeObj.straw_ingredient_id]) {
      reservedIngredients[cupSizeObj.straw_ingredient_id] =
        (reservedIngredients[cupSizeObj.straw_ingredient_id] || 0) + qty;
    }
  }
};

const accumulateItemUsage = (
  item,
  reservedProducts,
  reservedIngredients,
  { recipesByProduct = {}, ingredientsMap = {}, orderType = "DINE_IN" }
) => {
  if (!item?.id) return;
  const qty = Math.max(0, Number(item.qty ?? item.quantity) || 0);
  if (qty <= 0) return;

  const prodRecipes = recipesByProduct[item.id] || [];
  const isTrackStock = Boolean(item.baseProduct?.track_stock ?? item.track_stock);

  if (isTrackStock) {
    reservedProducts[item.id] = (reservedProducts[item.id] || 0) + qty;
    return;
  }

  const cupSizeName = item.cup_size_obj?.name || item.cup_size || null;

  if (prodRecipes.length === 0) {
    reservedProducts[item.id] = (reservedProducts[item.id] || 0) + qty;
  } else {
    for (const recipe of prodRecipes) {
      const ing = ingredientsMap[recipe.ingredient_id];
      if (!ing) continue;
      const resolvedQty = resolveRecipeQuantityForSize(recipe, cupSizeName, item.cup_size_obj || null);
      const sugarFactor = isSweetenerIngredient(ing) ? getSugarScaleFactor(item.modifiers) : 1;
      const perUnit = convertToBaseUnit(
        resolvedQty * sugarFactor,
        recipe.recipe_unit || ing.unit,
        ing.unit
      );
      if (perUnit > 0) {
        reservedIngredients[recipe.ingredient_id] =
          (reservedIngredients[recipe.ingredient_id] || 0) + perUnit * qty;
      }
    }
  }

  accumulatePackagingUsage(reservedIngredients, item.cup_size_obj, qty, orderType, ingredientsMap);

  if (Array.isArray(item.add_ons)) {
    for (const rawAddon of item.add_ons) {
      const addon = parseAddOnEntry(rawAddon);
      if (!addon?.ingredient_id) continue;
      const ing = ingredientsMap[addon.ingredient_id];
      if (!ing) continue;

      const perAddonQty = Math.max(0, Number(addon.quantity) || 0);
      const aoQty = Math.max(0, parseInt(addon.customer_qty ?? addon.quantity ?? 1, 10) || 0);
      if (perAddonQty * aoQty <= 0) continue;

      const deductionPerUnit = convertToBaseUnit(perAddonQty, addon.unit || ing.unit, ing.unit);
      if (deductionPerUnit > 0) {
        reservedIngredients[addon.ingredient_id] =
          (reservedIngredients[addon.ingredient_id] || 0) + deductionPerUnit * qty * aoQty;
      }
    }
  }
};

export const calculateReservedStock = ({
  cart = [],
  ongoingOrders = [],
  recipesByProduct = {},
  ingredientsMap = {},
  excludeCartItemId = null,
  excludeOrderId = null,
  orderType = "DINE_IN"
} = {}) => {
  const reservedProducts = {};
  const reservedIngredients = {};

  (cart || []).forEach((item) => {
    if (excludeCartItemId && item.cartItemId === excludeCartItemId) return;
    accumulateItemUsage(item, reservedProducts, reservedIngredients, {
      recipesByProduct,
      ingredientsMap,
      orderType
    });
  });

  (ongoingOrders || []).forEach((order) => {
    if (excludeOrderId && order.id === excludeOrderId) return;
    const orderTypeForOrder = order.order_type || "DINE_IN";
    (order.items || []).forEach((item) => {
      accumulateItemUsage(item, reservedProducts, reservedIngredients, {
        recipesByProduct,
        ingredientsMap,
        orderType: orderTypeForOrder
      });
    });
  });

  return { reservedProducts, reservedIngredients };
};

export const getProductStockSummary = (
  product,
  { recipesByProduct = {}, ingredientsMap = {}, reserved = null, virtualProduct = null } = {}
) => {
  if (!product) {
    return {
      mode: "direct",
      totalPossible: 0,
      remainingOrderable: 0,
      reservedQty: 0,
      recipeTotalPossible: 0,
      recipeRemainingOrderable: 0,
      limitingIngredients: [],
      limitedByCups: false,
      recipeBreakdown: [],
      sizeAvailability: []
    };
  }

  const prodRecipes = recipesByProduct[product.id] || [];
  if (product.track_stock || prodRecipes.length === 0) {
    const totalPossible = Math.max(0, Math.floor((parseFloat(product.stock_quantity) || 0) + STOCK_EPSILON));
    const reservedQty = Math.max(0, Math.floor((reserved?.reservedProducts?.[product.id] || 0) + STOCK_EPSILON));
    const remainingOrderable = Math.max(0, totalPossible - reservedQty);

    return {
      mode: "direct",
      totalPossible,
      remainingOrderable,
      reservedQty,
      recipeTotalPossible: totalPossible,
      recipeRemainingOrderable: remainingOrderable,
      limitingIngredients: [],
      limitedByCups: false,
      recipeBreakdown: [],
      sizeAvailability: []
    };
  }

  const recipeBreakdown = prodRecipes.map((recipe) => {
    const ing = ingredientsMap[recipe.ingredient_id];
    const isMissing = !ing;
    const stockUnit = (ing?.unit || "").toUpperCase();
    const recipeUnit = (recipe.recipe_unit || ing?.unit || "").toUpperCase();
    const totalStock = getUsableStock(ing);
    const reservedStock = ing ? reserved?.reservedIngredients?.[recipe.ingredient_id] || 0 : 0;
    const remainingStock = Math.max(0, totalStock - reservedStock);
    const perUnit = ing ? convertToBaseUnit(recipe.quantity_used, recipeUnit, ing.unit) : Infinity;

    const maxFromTotal = isMissing
      ? 0
      : perUnit > 0
        ? Math.max(0, Math.floor((totalStock + STOCK_EPSILON) / perUnit))
        : Infinity;
    const maxFromRemaining = isMissing
      ? 0
      : perUnit > 0
        ? Math.max(0, Math.floor((remainingStock + STOCK_EPSILON) / perUnit))
        : Infinity;

    return {
      id: recipe.id,
      ingredientId: recipe.ingredient_id,
      name: ing?.name || "Missing ingredient",
      quantityUsed: parseFloat(recipe.quantity_used) || 0,
      sizeQuantities: recipe.size_quantities || null,
      recipeUnit,
      stockUnit,
      totalStock,
      reservedStock,
      remainingStock,
      perUnit,
      maxFromTotal,
      maxFromRemaining,
      isMissing,
      isLimiting: false
    };
  });

  const hasMissing = recipeBreakdown.some((b) => b.isMissing);
  const finiteTotals = recipeBreakdown.map((b) => b.maxFromTotal).filter(Number.isFinite);
  const finiteRemaining = recipeBreakdown.map((b) => b.maxFromRemaining).filter(Number.isFinite);

  const baseRecipeTotalPossible = hasMissing ? 0 : (finiteTotals.length > 0 ? Math.min(...finiteTotals) : 0);
  const baseRecipeRemainingOrderable = hasMissing ? 0 : (finiteRemaining.length > 0 ? Math.min(...finiteRemaining) : 0);

  const sizes = virtualProduct?.sizes || product.sizes || [];
  const sizeAvailability = sizes.map((sz) => {
    const sizeName = sz?.name || sz?.size || "Standard";
    let sizeRecipeTotal = hasMissing ? 0 : Infinity;
    let sizeRecipeRemaining = hasMissing ? 0 : Infinity;

    if (!hasMissing) {
      for (const recipe of prodRecipes) {
        const ing = ingredientsMap[recipe.ingredient_id];
        if (!ing) {
          sizeRecipeTotal = 0;
          sizeRecipeRemaining = 0;
          break;
        }
        const resolvedQty = resolveRecipeQuantityForSize(recipe, sizeName, sz);
        if (resolvedQty <= 0) continue;

        const recipeUnit = (recipe.recipe_unit || ing.unit || "").toUpperCase();
        const perUnit = convertToBaseUnit(resolvedQty, recipeUnit, ing.unit);
        if (perUnit <= 0) continue;

        const totalStock = getUsableStock(ing);
        const reservedStock = reserved?.reservedIngredients?.[recipe.ingredient_id] || 0;
        const remainingStock = Math.max(0, totalStock - reservedStock);

        sizeRecipeTotal = Math.min(sizeRecipeTotal, Math.max(0, Math.floor((totalStock + STOCK_EPSILON) / perUnit)));
        sizeRecipeRemaining = Math.min(sizeRecipeRemaining, Math.max(0, Math.floor((remainingStock + STOCK_EPSILON) / perUnit)));
      }
      if (!Number.isFinite(sizeRecipeTotal)) sizeRecipeTotal = baseRecipeTotalPossible;
      if (!Number.isFinite(sizeRecipeRemaining)) sizeRecipeRemaining = baseRecipeRemainingOrderable;
    }

    const ingredientId = sz?.ingredient_id || null;
    if (!ingredientId) {
      return {
        name: sizeName,
        ingredientId: null,
        cupName: null,
        cupTotal: null,
        cupRemaining: null,
        sizeRecipeTotal,
        sizeRecipeRemaining,
        maxForSizeTotal: sizeRecipeTotal,
        maxForSizeRemaining: sizeRecipeRemaining
      };
    }

    const cupIng = ingredientsMap[ingredientId];
    const rawStock = getUsableStock(cupIng);
    const cupReserved = cupIng ? reserved?.reservedIngredients?.[ingredientId] || 0 : 0;
    const cupTotal = cupIng ? Math.max(0, Math.floor(rawStock + STOCK_EPSILON)) : 0;
    const cupRemaining = cupIng
      ? Math.max(0, Math.floor(Math.max(0, rawStock - cupReserved) + STOCK_EPSILON))
      : 0;

    return {
      name: sizeName,
      ingredientId,
      cupName: cupIng?.name || "Cup material",
      cupTotal,
      cupRemaining,
      sizeRecipeTotal,
      sizeRecipeRemaining,
      maxForSizeTotal: Math.min(sizeRecipeTotal, cupTotal),
      maxForSizeRemaining: Math.min(sizeRecipeRemaining, cupRemaining)
    };
  });

  const recipeTotalPossible =
    sizeAvailability.length > 0
      ? Math.max(...sizeAvailability.map((s) => s.sizeRecipeTotal))
      : baseRecipeTotalPossible;
  const recipeRemainingOrderable =
    sizeAvailability.length > 0
      ? Math.max(...sizeAvailability.map((s) => s.sizeRecipeRemaining))
      : baseRecipeRemainingOrderable;

  let totalPossible = recipeTotalPossible;
  let remainingOrderable = recipeRemainingOrderable;
  let limitedByCups = false;

  if (sizeAvailability.length > 0 && sizeAvailability.every((s) => Boolean(s.ingredientId))) {
    const uniqueCupTotals = new Map();
    const uniqueCupRemaining = new Map();
    sizeAvailability.forEach((s) => {
      if (s.sizeRecipeTotal > 0 && !uniqueCupTotals.has(s.ingredientId)) {
        uniqueCupTotals.set(s.ingredientId, s.cupTotal || 0);
      }
      if (s.sizeRecipeRemaining > 0 && !uniqueCupRemaining.has(s.ingredientId)) {
        uniqueCupRemaining.set(s.ingredientId, s.cupRemaining || 0);
      }
    });

    let totalCupCap = 0;
    uniqueCupTotals.forEach((val) => { totalCupCap += val; });
    let remCupCap = 0;
    uniqueCupRemaining.forEach((val) => { remCupCap += val; });

    totalPossible = Math.min(recipeTotalPossible, totalCupCap);
    remainingOrderable = Math.min(recipeRemainingOrderable, remCupCap);
    limitedByCups = remCupCap < recipeRemainingOrderable;
  } else if (sizeAvailability.length > 0) {
    totalPossible = Math.max(...sizeAvailability.map((s) => s.maxForSizeTotal));
    remainingOrderable = Math.max(...sizeAvailability.map((s) => s.maxForSizeRemaining));
  }

  recipeBreakdown.forEach((b) => {
    if (b.isMissing || b.maxFromRemaining === baseRecipeRemainingOrderable) {
      b.isLimiting = true;
    }
  });

  const limitingIngredients = recipeBreakdown
    .filter((b) => b.isLimiting)
    .map((b) => ({
      name: b.name,
      maxFromRemaining: b.maxFromRemaining,
      isMissing: b.isMissing
    }));

  const reservedQty = Math.max(0, totalPossible - remainingOrderable);

  return {
    mode: "recipe",
    totalPossible,
    remainingOrderable,
    reservedQty,
    recipeTotalPossible,
    recipeRemainingOrderable,
    limitingIngredients,
    limitedByCups,
    recipeBreakdown,
    sizeAvailability
  };
};

export const getMaxQtyForConfiguredItem = ({
  product,
  cupSizeObj = null,
  cupSizeName = null,
  addOnsList = [],
  modifiers = null,
  orderType = "DINE_IN",
  recipesByProduct = {},
  ingredientsMap = {},
  reserved = null,
  existingSameLineQty = 0
} = {}) => {
  if (!product) {
    return { stockMax: 0, maxQty: 0, limitingName: null };
  }

  const prodRecipes = recipesByProduct[product.id] || [];
  if (product.track_stock || prodRecipes.length === 0) {
    const available = Math.max(
      0,
      (parseFloat(product.stock_quantity) || 0) - (reserved?.reservedProducts?.[product.id] || 0)
    );
    const stockMax = Math.max(0, Math.floor(available + STOCK_EPSILON));
    const maxQty = Math.min(stockMax, Math.max(0, MAX_LINE_QTY - existingSameLineQty));
    return {
      stockMax,
      maxQty,
      limitingName: stockMax <= 0 ? product.name : null
    };
  }

  const perUnitMap = {};
  const targetSizeName = cupSizeObj?.name || cupSizeName || null;

  for (const recipe of prodRecipes) {
    const ing = ingredientsMap[recipe.ingredient_id];
    if (!ing) {
      return { stockMax: 0, maxQty: 0, limitingName: "Missing recipe ingredient" };
    }
    const resolvedQty = resolveRecipeQuantityForSize(recipe, targetSizeName, cupSizeObj);
    const sugarFactor = isSweetenerIngredient(ing) ? getSugarScaleFactor(modifiers) : 1;
    const perUnit = convertToBaseUnit(resolvedQty * sugarFactor, recipe.recipe_unit || ing.unit, ing.unit);
    if (perUnit <= 0) continue;

    if (!perUnitMap[recipe.ingredient_id]) {
      perUnitMap[recipe.ingredient_id] = { perUnit: 0, name: ing.name };
    }
    perUnitMap[recipe.ingredient_id].perUnit += perUnit;
  }

  const normOrderType = String(orderType || "DINE_IN").toUpperCase();
  const skipCup = normOrderType === "DINE_IN" && Boolean(cupSizeObj?.dine_in_no_cup);

  if (!skipCup && cupSizeObj?.ingredient_id) {
    const cupIng = ingredientsMap[cupSizeObj.ingredient_id];
    if (!cupIng) {
      return { stockMax: 0, maxQty: 0, limitingName: cupSizeObj.name || "Cup material" };
    }
    if (!perUnitMap[cupSizeObj.ingredient_id]) {
      perUnitMap[cupSizeObj.ingredient_id] = { perUnit: 0, name: cupIng.name };
    }
    perUnitMap[cupSizeObj.ingredient_id].perUnit += 1;
  }

  if (normOrderType === "TAKE_OUT" || normOrderType === "DELIVERY") {
    if (cupSizeObj?.lid_ingredient_id) {
      const lidIng = ingredientsMap[cupSizeObj.lid_ingredient_id];
      if (!lidIng) {
        return { stockMax: 0, maxQty: 0, limitingName: "Lid material" };
      }
      if (!perUnitMap[cupSizeObj.lid_ingredient_id]) {
        perUnitMap[cupSizeObj.lid_ingredient_id] = { perUnit: 0, name: lidIng.name };
      }
      perUnitMap[cupSizeObj.lid_ingredient_id].perUnit += 1;
    }
    if (cupSizeObj?.straw_ingredient_id) {
      const strawIng = ingredientsMap[cupSizeObj.straw_ingredient_id];
      if (!strawIng) {
        return { stockMax: 0, maxQty: 0, limitingName: "Straw material" };
      }
      if (!perUnitMap[cupSizeObj.straw_ingredient_id]) {
        perUnitMap[cupSizeObj.straw_ingredient_id] = { perUnit: 0, name: strawIng.name };
      }
      perUnitMap[cupSizeObj.straw_ingredient_id].perUnit += 1;
    }
  }

  for (const rawAddon of addOnsList || []) {
    const ao = parseAddOnEntry(rawAddon);
    if (!ao?.ingredient_id) continue;
    const perAddonQty = Math.max(0, Number(ao.quantity) || 0);
    const aoQty = Math.max(0, parseInt(ao.customer_qty ?? ao.quantity ?? 1, 10) || 0);
    if (perAddonQty * aoQty <= 0) continue;

    const aoIng = ingredientsMap[ao.ingredient_id];
    if (!aoIng) {
      return { stockMax: 0, maxQty: 0, limitingName: ao.name || "Add-on material" };
    }
    const perUnit = convertToBaseUnit(perAddonQty, ao.unit || aoIng.unit, aoIng.unit) * aoQty;
    if (!perUnitMap[ao.ingredient_id]) {
      perUnitMap[ao.ingredient_id] = { perUnit: 0, name: aoIng.name };
    }
    perUnitMap[ao.ingredient_id].perUnit += perUnit;
  }

  let stockMax = Infinity;
  let limitingName = null;

  for (const [ingId, entry] of Object.entries(perUnitMap)) {
    const ing = ingredientsMap[ingId];
    const available = Math.max(
      0,
      getUsableStock(ing) - (reserved?.reservedIngredients?.[ingId] || 0)
    );
    const possible = entry.perUnit > 0
      ? Math.max(0, Math.floor((available + STOCK_EPSILON) / entry.perUnit))
      : Infinity;

    if (possible < stockMax) {
      stockMax = possible;
      limitingName = entry.name;
    }
  }

  const resolvedStockMax = Number.isFinite(stockMax) ? stockMax : MAX_LINE_QTY;
  const maxQty = Math.min(resolvedStockMax, Math.max(0, MAX_LINE_QTY - existingSameLineQty));

  return {
    stockMax: resolvedStockMax,
    maxQty,
    limitingName
  };
};

export const getMaxAddOnQty = ({
  product,
  cupSizeObj = null,
  cupSizeName = null,
  currentAddOns = [],
  targetAddon = null,
  currentItemQty = 1,
  modifiers = null,
  orderType = "DINE_IN",
  recipesByProduct = {},
  ingredientsMap = {},
  reserved = null
} = {}) => {
  if (!targetAddon?.ingredient_id || product?.track_stock || (Number(targetAddon.quantity) || 0) <= 0) {
    return MAX_ADDON_QTY;
  }

  const ing = ingredientsMap[targetAddon.ingredient_id];
  if (!ing) return 0;

  const targetIngId = targetAddon.ingredient_id;
  const totalAvailable = Math.max(
    0,
    getUsableStock(ing) - (reserved?.reservedIngredients?.[targetIngId] || 0)
  );

  let otherUsagePerUnit = 0;
  const targetSizeName = cupSizeObj?.name || cupSizeName || null;
  const prodRecipes = recipesByProduct[product?.id] || [];
  for (const recipe of prodRecipes) {
    if (recipe.ingredient_id === targetIngId) {
      const resolvedQty = resolveRecipeQuantityForSize(recipe, targetSizeName, cupSizeObj);
      const sugarFactor = isSweetenerIngredient(ing) ? getSugarScaleFactor(modifiers) : 1;
      otherUsagePerUnit += convertToBaseUnit(
        resolvedQty * sugarFactor,
        recipe.recipe_unit || ing.unit,
        ing.unit
      );
    }
  }

  const normOrderType = String(orderType || "DINE_IN").toUpperCase();
  const skipCup = normOrderType === "DINE_IN" && Boolean(cupSizeObj?.dine_in_no_cup);
  if (!skipCup && cupSizeObj?.ingredient_id === targetIngId) {
    otherUsagePerUnit += 1;
  }
  if (normOrderType === "TAKE_OUT" || normOrderType === "DELIVERY") {
    if (cupSizeObj?.lid_ingredient_id === targetIngId) otherUsagePerUnit += 1;
    if (cupSizeObj?.straw_ingredient_id === targetIngId) otherUsagePerUnit += 1;
  }

  for (const ao of currentAddOns || []) {
    if (!ao || ao.name === targetAddon.name) continue;
    if (ao.ingredient_id === targetIngId) {
      const perAddonQty = Math.max(0, Number(ao.quantity) || 0);
      const aoQty = Math.max(0, parseInt(ao.customer_qty ?? 0, 10) || 0);
      if (perAddonQty * aoQty > 0) {
        otherUsagePerUnit += convertToBaseUnit(perAddonQty, ao.unit || ing.unit, ing.unit) * aoQty;
      }
    }
  }

  const qtyCount = Math.max(1, Number(currentItemQty) || 1);
  const remainingForThisAddon = Math.max(0, totalAvailable - otherUsagePerUnit * qtyCount);
  const perOneServingForOrder =
    convertToBaseUnit(Number(targetAddon.quantity) || 0, targetAddon.unit || ing.unit, ing.unit) * qtyCount;

  const maxByStock = perOneServingForOrder > 0
    ? Math.floor((remainingForThisAddon + STOCK_EPSILON) / perOneServingForOrder)
    : MAX_ADDON_QTY;

  return Math.min(MAX_ADDON_QTY, Math.max(0, maxByStock));
};

export const validateItemsAgainstStock = (
  items = [],
  { productsMap = {}, recipesByProduct = {}, ingredientsMap = {}, reserved = null, orderType = "DINE_IN" } = {}
) => {
  const issues = [];
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: true, issues };
  }

  const normalizedItems = items.map((item) => {
    const liveProduct = productsMap[item.id] || item.baseProduct || item;
    return {
      ...item,
      track_stock: liveProduct?.track_stock ?? item.track_stock
    };
  });

  const normOrderType = String(orderType || "DINE_IN").toUpperCase();

  for (const item of normalizedItems) {
    const prod = productsMap[item.id] || item.baseProduct || item;
    if (Object.keys(productsMap).length > 0 && !productsMap[item.id]) {
      issues.push(`${item.name || "A product"} is no longer available`);
      continue;
    }

    const prodRecipes = recipesByProduct[item.id] || [];
    if (!prod?.track_stock && prodRecipes.length > 0) {
      const missingRecipeIng = prodRecipes.some((r) => !ingredientsMap[r.ingredient_id]);
      if (missingRecipeIng) {
        issues.push(`${prod.name || item.name} has a missing recipe ingredient`);
      }

      const skipCup = normOrderType === "DINE_IN" && Boolean(item.cup_size_obj?.dine_in_no_cup);
      if (!skipCup && item.cup_size_obj?.ingredient_id && !ingredientsMap[item.cup_size_obj.ingredient_id]) {
        issues.push(`${prod.name || item.name} cup material is unavailable`);
      }

      if (normOrderType === "TAKE_OUT" || normOrderType === "DELIVERY") {
        if (item.cup_size_obj?.lid_ingredient_id && !ingredientsMap[item.cup_size_obj.lid_ingredient_id]) {
          issues.push(`${prod.name || item.name} lid material is unavailable`);
        }
        if (item.cup_size_obj?.straw_ingredient_id && !ingredientsMap[item.cup_size_obj.straw_ingredient_id]) {
          issues.push(`${prod.name || item.name} straw material is unavailable`);
        }
      }

      if (Array.isArray(item.add_ons)) {
        for (const rawAddon of item.add_ons) {
          const ao = parseAddOnEntry(rawAddon);
          if (!ao?.ingredient_id) continue;
          const perAddonQty = Math.max(0, Number(ao.quantity) || 0);
          const aoQty = Math.max(0, parseInt(ao.customer_qty ?? ao.quantity ?? 1, 10) || 0);
          if (perAddonQty * aoQty > 0 && !ingredientsMap[ao.ingredient_id]) {
            issues.push(`${ao.name || "Add-on"} material is unavailable`);
          }
        }
      }
    }
  }

  const { reservedProducts: neededProducts, reservedIngredients: neededIngredients } =
    calculateReservedStock({
      cart: normalizedItems,
      ongoingOrders: [],
      recipesByProduct,
      ingredientsMap,
      orderType: normOrderType
    });

  for (const [pid, reqQty] of Object.entries(neededProducts)) {
    const fallbackItem = normalizedItems.find((i) => i.id === pid);
    const prod = productsMap[pid] || fallbackItem?.baseProduct || fallbackItem;
    const totalStock = parseFloat(prod?.stock_quantity) || 0;
    const alreadyReserved = reserved?.reservedProducts?.[pid] || 0;

    if (totalStock + STOCK_EPSILON < reqQty + alreadyReserved) {
      const available = Math.max(0, Math.floor(totalStock - alreadyReserved + STOCK_EPSILON));
      issues.push(
        `${prod?.name || "Product"} only has ${available} available in stock (requested ${reqQty})`
      );
    }
  }

  for (const [ingId, reqQty] of Object.entries(neededIngredients)) {
    const ing = ingredientsMap[ingId];
    const totalStock = getUsableStock(ing);
    const alreadyReserved = reserved?.reservedIngredients?.[ingId] || 0;

    if (totalStock + STOCK_EPSILON < reqQty + alreadyReserved) {
      const available = Math.max(0, Math.round((totalStock - alreadyReserved) * 100) / 100);
      const unit = (ing?.unit || "").toUpperCase();
      issues.push(
        `Insufficient usable ${ing?.name || "ingredient"} (${available}${unit ? ` ${unit}` : ""} available)`
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
};

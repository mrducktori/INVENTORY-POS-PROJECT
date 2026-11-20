import { convertToBaseUnit } from "../../../utils/productUtils.js";

export const MAX_LINE_QTY = 99;
export const MAX_ADDON_QTY = 5;
export const STOCK_EPSILON = 1e-9;

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

const accumulateItemUsage = (
  item,
  reservedProducts,
  reservedIngredients,
  { recipesByProduct = {}, ingredientsMap = {} }
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

  if (prodRecipes.length === 0) {
    reservedProducts[item.id] = (reservedProducts[item.id] || 0) + qty;
  } else {
    for (const recipe of prodRecipes) {
      const ing = ingredientsMap[recipe.ingredient_id];
      if (!ing) continue;
      const perUnit = convertToBaseUnit(recipe.quantity_used, recipe.recipe_unit || ing.unit, ing.unit);
      if (perUnit > 0) {
        reservedIngredients[recipe.ingredient_id] =
          (reservedIngredients[recipe.ingredient_id] || 0) + perUnit * qty;
      }
    }
  }

  if (item.cup_size_obj?.ingredient_id && ingredientsMap[item.cup_size_obj.ingredient_id]) {
    const cupIngId = item.cup_size_obj.ingredient_id;
    reservedIngredients[cupIngId] = (reservedIngredients[cupIngId] || 0) + qty;
  }

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
  excludeOrderId = null
} = {}) => {
  const reservedProducts = {};
  const reservedIngredients = {};

  (cart || []).forEach((item) => {
    if (excludeCartItemId && item.cartItemId === excludeCartItemId) return;
    accumulateItemUsage(item, reservedProducts, reservedIngredients, {
      recipesByProduct,
      ingredientsMap
    });
  });

  (ongoingOrders || []).forEach((order) => {
    if (excludeOrderId && order.id === excludeOrderId) return;
    (order.items || []).forEach((item) => {
      accumulateItemUsage(item, reservedProducts, reservedIngredients, {
        recipesByProduct,
        ingredientsMap
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
    const totalStock = ing ? parseFloat(ing.stock_quantity) || 0 : 0;
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

  const recipeTotalPossible = hasMissing ? 0 : (finiteTotals.length > 0 ? Math.min(...finiteTotals) : 0);
  const recipeRemainingOrderable = hasMissing ? 0 : (finiteRemaining.length > 0 ? Math.min(...finiteRemaining) : 0);

  const sizes = virtualProduct?.sizes || product.sizes || [];
  const sizeAvailability = sizes.map((sz) => {
    const sizeName = sz?.name || sz?.size || "Standard";
    const ingredientId = sz?.ingredient_id || null;
    if (!ingredientId) {
      return {
        name: sizeName,
        ingredientId: null,
        cupName: null,
        cupTotal: null,
        cupRemaining: null,
        maxForSizeTotal: recipeTotalPossible,
        maxForSizeRemaining: recipeRemainingOrderable
      };
    }

    const cupIng = ingredientsMap[ingredientId];
    const rawStock = cupIng ? parseFloat(cupIng.stock_quantity) || 0 : 0;
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
      maxForSizeTotal: Math.min(recipeTotalPossible, cupTotal),
      maxForSizeRemaining: Math.min(recipeRemainingOrderable, cupRemaining)
    };
  });

  let totalPossible = recipeTotalPossible;
  let remainingOrderable = recipeRemainingOrderable;
  let limitedByCups = false;

  if (sizeAvailability.length > 0 && sizeAvailability.every((s) => Boolean(s.ingredientId))) {
    const uniqueCupTotals = new Map();
    const uniqueCupRemaining = new Map();
    sizeAvailability.forEach((s) => {
      if (!uniqueCupTotals.has(s.ingredientId)) {
        uniqueCupTotals.set(s.ingredientId, s.cupTotal || 0);
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
  }

  recipeBreakdown.forEach((b) => {
    if (b.isMissing || b.maxFromRemaining === recipeRemainingOrderable) {
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
  addOnsList = [],
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

  for (const recipe of prodRecipes) {
    const ing = ingredientsMap[recipe.ingredient_id];
    if (!ing) {
      return { stockMax: 0, maxQty: 0, limitingName: "Missing recipe ingredient" };
    }
    const perUnit = convertToBaseUnit(recipe.quantity_used, recipe.recipe_unit || ing.unit, ing.unit);
    if (!perUnitMap[recipe.ingredient_id]) {
      perUnitMap[recipe.ingredient_id] = { perUnit: 0, name: ing.name };
    }
    perUnitMap[recipe.ingredient_id].perUnit += perUnit;
  }

  if (cupSizeObj?.ingredient_id) {
    const cupIng = ingredientsMap[cupSizeObj.ingredient_id];
    if (!cupIng) {
      return { stockMax: 0, maxQty: 0, limitingName: cupSizeObj.name || "Cup material" };
    }
    if (!perUnitMap[cupSizeObj.ingredient_id]) {
      perUnitMap[cupSizeObj.ingredient_id] = { perUnit: 0, name: cupIng.name };
    }
    perUnitMap[cupSizeObj.ingredient_id].perUnit += 1;
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
      (parseFloat(ing?.stock_quantity) || 0) - (reserved?.reservedIngredients?.[ingId] || 0)
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
  currentAddOns = [],
  targetAddon = null,
  currentItemQty = 1,
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
    (parseFloat(ing.stock_quantity) || 0) - (reserved?.reservedIngredients?.[targetIngId] || 0)
  );

  let otherUsagePerUnit = 0;
  const prodRecipes = recipesByProduct[product?.id] || [];
  for (const recipe of prodRecipes) {
    if (recipe.ingredient_id === targetIngId) {
      otherUsagePerUnit += convertToBaseUnit(recipe.quantity_used, recipe.recipe_unit || ing.unit, ing.unit);
    }
  }

  if (cupSizeObj?.ingredient_id === targetIngId) {
    otherUsagePerUnit += 1;
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
  { productsMap = {}, recipesByProduct = {}, ingredientsMap = {}, reserved = null } = {}
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

      if (item.cup_size_obj?.ingredient_id && !ingredientsMap[item.cup_size_obj.ingredient_id]) {
        issues.push(`${prod.name || item.name} cup material is unavailable`);
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
      ingredientsMap
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
    const totalStock = parseFloat(ing?.stock_quantity) || 0;
    const alreadyReserved = reserved?.reservedIngredients?.[ingId] || 0;

    if (totalStock + STOCK_EPSILON < reqQty + alreadyReserved) {
      const available = Math.max(0, Math.round((totalStock - alreadyReserved) * 100) / 100);
      const unit = (ing?.unit || "").toUpperCase();
      issues.push(
        `Insufficient ${ing?.name || "ingredient"} (${available}${unit ? ` ${unit}` : ""} available)`
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
};

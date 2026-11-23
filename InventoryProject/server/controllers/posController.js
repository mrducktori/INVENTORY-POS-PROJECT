import * as posService from "../services/posService.js";

export const getProducts = async (req, res) => {
  try {
    const data = await posService.getProducts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPosCatalog = async (req, res) => {
  try {
    const data = await posService.getPosCatalog();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const ALLOWED_ORDER_TYPES = new Set(["DINE_IN", "TAKE_OUT", "DELIVERY"]);
const ALLOWED_SUGAR_LEVELS = new Set(["0%", "25%", "50%", "75%", "100%"]);

export const createSale = async (req, res) => {
  try {
    const { cart, total, amount_received, payment_method, order_type } = req.body;

    let normalizedOrderType = "DINE_IN";
    if (order_type !== undefined && order_type !== null && String(order_type).trim() !== "") {
      normalizedOrderType = String(order_type).trim().toUpperCase().replace(/-/g, "_");
      if (!ALLOWED_ORDER_TYPES.has(normalizedOrderType)) {
        return res.status(400).json({
          error: "Invalid order_type. Must be DINE_IN, TAKE_OUT, or DELIVERY."
        });
      }
    }

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Cart cannot be empty." });
    }

    if (cart.length > 100) {
      return res.status(400).json({ error: "Cart exceeds maximum allowable items (100)." });
    }

    for (const item of cart) {
      if (!item.id || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
        return res.status(400).json({
          error: `Invalid quantity for item "${item.name || item.id}". Quantity must be an integer between 1 and 99.`
        });
      }

      if (item.modifiers !== undefined && item.modifiers !== null) {
        if (typeof item.modifiers !== "object" || Array.isArray(item.modifiers)) {
          return res.status(400).json({
            error: `Invalid modifiers format for "${item.name || item.id}".`
          });
        }
        const { sugar_level, ice_level, note } = item.modifiers;
        if (sugar_level !== undefined && sugar_level !== null && String(sugar_level).trim() !== "") {
          if (!ALLOWED_SUGAR_LEVELS.has(String(sugar_level).trim())) {
            return res.status(400).json({
              error: `Invalid sugar level for "${item.name || item.id}". Must be 0%, 25%, 50%, 75%, or 100%.`
            });
          }
        }
        if (ice_level !== undefined && ice_level !== null && String(ice_level).trim().length > 50) {
          return res.status(400).json({
            error: `Ice level for "${item.name || item.id}" must be at most 50 characters.`
          });
        }
        if (note !== undefined && note !== null && String(note).trim().length > 200) {
          return res.status(400).json({
            error: `Modifier note for "${item.name || item.id}" must be at most 200 characters.`
          });
        }
      }

      if (Array.isArray(item.add_ons)) {
        for (const ao of item.add_ons) {
          const rawAoQty = ao?.customer_qty ?? ao?.quantity ?? 1;
          const aoQty = Number(rawAoQty);
          if (!Number.isInteger(aoQty) || aoQty < 0 || aoQty > 5) {
            return res.status(400).json({
              error: `Invalid add-on quantity for "${ao?.name || 'add-on'}". Must be between 0 and 5.`
            });
          }
          if (ao?.quantity !== undefined && (!Number.isFinite(Number(ao.quantity)) || Number(ao.quantity) < 0)) {
            return res.status(400).json({
              error: `Invalid add-on recipe quantity for "${ao?.name || 'add-on'}".`
            });
          }
        }
      }
    }

    const parsedTotal = parseFloat(total);
    if (isNaN(parsedTotal) || parsedTotal < 0 || parsedTotal > 500000) {
      return res.status(400).json({ error: "Invalid order total amount." });
    }

    if (payment_method === 'CASH') {
      const received = parseFloat(amount_received);
      const maxCash = Math.min(100000, Math.max(parsedTotal + 5000, 50000));
      if (isNaN(received) || received < parsedTotal) {
        return res.status(400).json({ error: "Cash received must be greater than or equal to total." });
      }
      if (received > maxCash) {
        return res.status(400).json({
          error: `Cash received exceeds allowable maximum of ₱${maxCash.toLocaleString()}.`
        });
      }
    }

    const sale = await posService.createSale({
      ...req.body,
      order_type: normalizedOrderType,
      staff_id: req.user.id,
    });
    res.json({ message: "Sale completed", sale });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

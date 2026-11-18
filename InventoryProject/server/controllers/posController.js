import * as posService from "../services/posService.js";

export const getProducts = async (req, res) => {
  try {
    const data = await posService.getProducts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createSale = async (req, res) => {
  try {
    const { cart, total, amount_received, payment_method } = req.body;

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
      staff_id: req.user.id,
    });
    res.json({ message: "Sale completed", sale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

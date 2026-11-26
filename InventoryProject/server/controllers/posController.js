import * as posService from "../services/posService.js";
import * as posOperationsService from "../services/posOperationsService.js";
import * as forecastService from "../services/forecastService.js";
import * as extraSuppliesService from "../services/extraSuppliesService.js";
import { logAudit } from "../utils/auditHelper.js";

// End-of-day totals feed the forecast; a failed refresh must never fail the sale/shift action.
const refreshInBackground = (promise) => promise.catch((err) => console.warn("[forecast] daily refresh failed:", err.message));

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
    const {
      cart,
      order_type,
      discount_type,
      discount_id_number,
      customer_name,
      promo_code,
      custom_discount_mode,
      custom_discount_value,
      manager_pin,
      payment_method,
      amount_received,
      transaction_reference,
      payments
    } = req.body;

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
        const { sugar_level, ice_level, note, no_lid } = item.modifiers;
        if (no_lid !== undefined && typeof no_lid !== "boolean") {
          return res.status(400).json({ error: `Invalid lid option for "${item.name || item.id}".` });
        }
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

    const idempotencyKey = req.body.idempotency_key || req.headers["x-idempotency-key"] || "";

    const { sale, deduplicated } = await posOperationsService.runWithIdempotency(
      idempotencyKey,
      req.user.id,
      async () => {
        const posSettings = await posOperationsService.getPosSettings();
        const { subtotal, itemPrices } = await posOperationsService.computeAuthoritativeSubtotal(cart);
        // Same gate as void/refund: custom discounts need a manager PIN from any cashier.
        if (String(discount_type || "").trim().toUpperCase() === "CUSTOM") {
          if (!String(manager_pin ?? "").trim()) {
            throw Object.assign(new Error("Manager PIN is required for custom discounts."), { status: 403 });
          }
          await posOperationsService.verifyManagerPin(manager_pin, req.user.id);
        }
        const discountResult = posOperationsService.validateAndComputeDiscount({
          subtotal,
          cart,
          itemPrices,
          discount_type,
          discount_id_number,
          customer_name,
          promo_code,
          custom_discount_mode,
          custom_discount_value,
          posSettings
        });
        const paymentResult = posOperationsService.validateAndNormalizePayments({
          payment_method,
          amount_received,
          transaction_reference,
          payments,
          finalTotal: discountResult.final_total
        });

        // Price, size and add-on data all come from the server catalog, never the client payload.
        const authoritativeCart = cart.map((item, idx) => ({
          ...item,
          price: itemPrices[idx].unit_price,
          cup_size_obj: itemPrices[idx].cup_size_obj,
          add_ons: itemPrices[idx].add_ons
        }));

        // Client-supplied packaging is ignored; only server-configured takeout packaging applies.
        let orderPackagingItems = [];
        const takeoutCfg = posSettings?.takeout_packaging;
        if (
          takeoutCfg?.carrier_ingredient_id &&
          ((normalizedOrderType === "TAKE_OUT" && takeoutCfg.apply_to_takeout) ||
            (normalizedOrderType === "DELIVERY" && takeoutCfg.apply_to_delivery))
        ) {
          const pkgQty = Number(takeoutCfg.carrier_qty_per_order) || 1;
          if (pkgQty > 0) {
            orderPackagingItems = [
              { ingredient_id: takeoutCfg.carrier_ingredient_id, quantity: pkgQty }
            ];
          }
        }

        const createdSale = await posService.createSale({
          cart: authoritativeCart,
          notes: typeof req.body.notes === "string" ? req.body.notes.slice(0, 500) : "",
          order_type: normalizedOrderType,
          order_packaging_items: orderPackagingItems,
          total: discountResult.final_total,
          discount_amount: discountResult.discount_amount,
          payment_method: paymentResult.payment_method,
          amount_received: paymentResult.amount_received,
          change_amount: paymentResult.change_amount,
          transaction_reference: paymentResult.transaction_reference,
          staff_id: req.user.id
        });

        // Sale is committed: side effects below must not fail the request, or a client retry would double-sell.
        // The metadata (payments, Senior/PWD name + ID) is retried, and if it still cannot be saved the
        // full details go to the audit log so a discounted sale never ends up with no beneficiary record.
        const metadata = {
          payments: paymentResult.payments,
          discount_details: discountResult.discount_details,
          order_type: normalizedOrderType
        };
        let metadataSaved = false;
        for (let attempt = 1; attempt <= 3 && !metadataSaved; attempt += 1) {
          try {
            await posOperationsService.saveSaleMetadata(createdSale.id, metadata);
            metadataSaved = true;
          } catch (metaErr) {
            console.error(`[POS] Sale metadata save failed (attempt ${attempt}) for committed sale`, createdSale.id, metaErr);
          }
        }
        if (!metadataSaved) {
          try {
            await logAudit("SALE_METADATA_SAVE_FAILED", req.user.id, { sale_id: createdSale.id, ...metadata });
          } catch (auditErr) {
            console.error("[POS] Could not audit-log unsaved sale metadata", createdSale.id, auditErr);
          }
        }

        let kdsTicket = null;
        try {
          kdsTicket = await posOperationsService.enqueueKdsOrder({
            sale: createdSale,
            cart: authoritativeCart,
            order_type: normalizedOrderType
          });
        } catch (kdsErr) {
          console.error("[POS] KDS enqueue failed for committed sale", createdSale.id, kdsErr);
        }

        return {
          ...createdSale,
          subtotal_amount: discountResult.subtotal,
          discount_details: discountResult.discount_details,
          payments: paymentResult.payments,
          metadata_saved: metadataSaved,
          kds_ticket_id: kdsTicket?.id || null
        };
      },
      posOperationsService.hashCheckoutPayload(req.body)
    );

    res.json({
      message: deduplicated ? "Sale already processed" : "Sale completed",
      sale,
      deduplicated
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const createPaymentIntent = async (req, res) => {
  try {
    const intent = posOperationsService.generateQrPaymentIntent({
      provider: req.body?.provider,
      amount: req.body?.amount
    });
    res.json(intent);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const voidOrRefundSale = async (req, res) => {
  try {
    const record = await posOperationsService.voidOrRefundSale({
      sale_id: req.params.id,
      action_type: req.body?.action_type,
      reason: req.body?.reason,
      restock_policy: req.body?.restock_policy,
      manager_pin: req.body?.manager_pin,
      requested_by_user: req.user
    });
    refreshInBackground(forecastService.refreshDailySummaryForSale(req.params.id));
    res.json(record);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const setManagerPin = async (req, res) => {
  try {
    const result = await posOperationsService.setManagerPin({
      targetUserId: req.body?.target_user_id || req.body?.targetUserId || req.user.id,
      pin: req.body?.pin,
      actingUser: req.user
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getCurrentShift = async (req, res) => {
  try {
    const shift = await posOperationsService.getCurrentShift(req.user.id);
    res.json(shift);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const openShift = async (req, res) => {
  try {
    const shift = await posOperationsService.openShift({
      opening_cash: req.body?.opening_cash ?? 0,
      notes: req.body?.notes || "",
      user: req.user
    });
    res.status(201).json(shift);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getXReading = async (req, res) => {
  try {
    const reading = await posOperationsService.computeXReading({
      shift_id: req.query.shift_id || null,
      user: req.user
    });
    res.json(reading);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const closeShiftZReading = async (req, res) => {
  try {
    const shift = await posOperationsService.closeShiftZReading({
      shift_id: req.body?.shift_id || null,
      actual_cash_counted: req.body?.actual_cash_counted,
      notes: req.body?.notes || "",
      user: req.user
    });
    refreshInBackground(forecastService.refreshDailySummaryForDate());
    res.json(shift);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getShiftHistory = async (req, res) => {
  try {
    const history = await posOperationsService.getShiftHistory();
    res.json(history);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getKdsQueue = async (req, res) => {
  try {
    const tickets = await posOperationsService.getKdsQueue({
      station: req.query.station || "ALL",
      includeServed: req.query.include_served === "true" || req.query.includeServed === "true"
    });
    res.json(tickets);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const updateKdsTicketStatus = async (req, res) => {
  try {
    const ticket = await posOperationsService.updateKdsTicketStatus(
      req.params.id,
      req.body?.status,
      req.user
    );
    res.json(ticket);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getPosSettings = async (req, res) => {
  try {
    const settings = await posOperationsService.getPosSettings();
    res.json(settings);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const updatePosSettings = async (req, res) => {
  try {
    const settings = await posOperationsService.updatePosSettings(req.body, req.user);
    res.json(settings);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
};

export const getManagerPinStatus = async (req, res) => {
  try {
    const status = await posOperationsService.getManagerPinStatus();
    res.json(status);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getExtraSupplies = async (req, res) => {
  try {
    res.json(await extraSuppliesService.listExtraSupplies());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const useExtraSupply = async (req, res) => {
  try {
    res.status(201).json(await extraSuppliesService.useExtraSupply(req.body || {}, req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

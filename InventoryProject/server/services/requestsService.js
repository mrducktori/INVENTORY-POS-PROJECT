import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";
import { getManilaISOString } from "../utils/dateUtils.js";
import { fetchAllRows } from "../utils/costUtils.js";

let hasRequestsTable = null; // null = unknown, true = exists, false = use audit_logs fallback

const isMissingTableError = (error) => {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("could not find the table")
  );
};

const parseAuditRequestRow = (row) => {
  let payload = {};
  if (row.new_value && typeof row.new_value === "object") {
    payload = row.new_value;
  } else if (row.details) {
    try {
      payload = typeof row.details === "string" ? JSON.parse(row.details) : row.details;
    } catch {
      payload = { description: String(row.details) };
    }
  }
  return {
    id: row.id,
    type: payload.type || "OTHER",
    status: payload.status || "PENDING",
    details: payload.details || payload,
    requested_by: row.user_id,
    created_at: row.created_at,
    users: row.users || null
  };
};

export const createRequest = async ({ type, details, requested_by }) => {
  if (typeof type !== "string" || !type.trim()) {
    const err = new Error("Request type is required");
    err.status = 400;
    throw err;
  }
  if (hasRequestsTable !== false) {
    const { data, error } = await supabase
      .from("requests")
      .insert([{
        type,
        details,
        status: "PENDING",
        requested_by
      }])
      .select()
      .single();

    if (!error) {
      hasRequestsTable = true;
      await logAudit("STAFF_REQUEST_CREATED", requested_by, {
        request_id: data.id,
        type,
        details
      });
      return data;
    }

    if (!isMissingTableError(error)) throw error;
    hasRequestsTable = false;
  }

  // Fallback: store in audit_logs with action='STAFF_REQUEST' and entity_type='REQUEST'
  const payload = {
    type: type || "OTHER",
    status: "PENDING",
    details: details || {},
    requested_by
  };

  const { data: logRow, error: logErr } = await supabase
    .from("audit_logs")
    .insert([{
      action: "STAFF_REQUEST",
      action_type: "STAFF_REQUEST",
      entity_type: "REQUEST",
      user_id: requested_by,
      details: JSON.stringify(payload),
      new_value: payload,
      created_at: getManilaISOString()
    }])
    .select(`*, users(id, name, username, role)`)
    .single();

  if (logErr) throw logErr;
  return parseAuditRequestRow(logRow);
};

export const getRequests = async (filters = {}) => {
  if (hasRequestsTable !== false) {
    let query = supabase
      .from("requests")
      .select(`
        *,
        users(id, name, username, role)
      `)
      .order("created_at", { ascending: false })
      .order("id");

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.requested_by) query = query.eq("requested_by", filters.requested_by);

    try {
      const data = await fetchAllRows(() => query);
      hasRequestsTable = true;
      return data;
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      hasRequestsTable = false;
    }
  }

  const rows = await fetchAllRows(() => {
    let q = supabase
      .from("audit_logs")
      .select(`*, users(id, name, username, role)`)
      .eq("action", "STAFF_REQUEST")
      .order("created_at", { ascending: false })
      .order("id");
    if (filters.requested_by) q = q.eq("user_id", filters.requested_by);
    return q;
  });

  return (rows || [])
    .map(parseAuditRequestRow)
    .filter(r => (!filters.status || r.status === filters.status) && (!filters.type || r.type === filters.type));
};

export const getPendingRequests = async () => {
  return getRequests({ status: "PENDING" });
};

export const updateRequestStatus = async (id, status, updatedBy = null) => {
  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Invalid status. Must be PENDING, APPROVED, or REJECTED");
  }

  if (hasRequestsTable !== false) {
    const { data, error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (!error) {
      hasRequestsTable = true;
      await logAudit("STAFF_REQUEST_STATUS_UPDATED", updatedBy, {
        request_id: id,
        new_status: status
      });
      return data;
    }
    if (!isMissingTableError(error)) throw error;
    hasRequestsTable = false;
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("audit_logs")
    .select(`*, users(id, name, username, role)`)
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;

  const parsed = parseAuditRequestRow(existing);
  const updatedPayload = {
    type: parsed.type,
    status,
    details: parsed.details,
    requested_by: parsed.requested_by,
    reviewed_by: updatedBy,
    reviewed_at: getManilaISOString()
  };

  const { data: updatedRow, error: upErr } = await supabase
    .from("audit_logs")
    .update({
      details: JSON.stringify(updatedPayload),
      new_value: updatedPayload
    })
    .eq("id", id)
    .select(`*, users(id, name, username, role)`)
    .single();
  if (upErr) throw upErr;

  await logAudit("STAFF_REQUEST_STATUS_UPDATED", updatedBy, {
    request_id: id,
    new_status: status
  });

  return parseAuditRequestRow(updatedRow);
};

export const getRequestStats = async () => {
  const stats = { total: 0, pending: 0, approved: 0, rejected: 0, byType: {} };

  if (hasRequestsTable !== false) {
    const counts = await Promise.all(["PENDING", "APPROVED", "REJECTED"].map((s) =>
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", s)
    ));
    const missing = counts.find((c) => c.error && isMissingTableError(c.error));
    const failed = counts.find((c) => c.error && !isMissingTableError(c.error));
    if (failed) throw failed.error;
    if (!missing) {
      hasRequestsTable = true;
      ["pending", "approved", "rejected"].forEach((k, i) => { stats[k] = counts[i].count || 0; });
      stats.total = stats.pending + stats.approved + stats.rejected;
      // byType needs a group-by; only the type column is fetched
      const types = await fetchAllRows(() => supabase.from("requests").select("type").order("id"));
      types.forEach((r) => { stats.byType[r.type] = (stats.byType[r.type] || 0) + 1; });
      return stats;
    }
    hasRequestsTable = false;
  }

  // audit_logs fallback stores status inside JSON, so rows must be parsed
  const data = await getRequests({});
  stats.total = data.length;
  data.forEach(req => {
    const key = String(req.status || "PENDING").toLowerCase();
    if (stats[key] !== undefined) stats[key]++;
    stats.byType[req.type] = (stats.byType[req.type] || 0) + 1;
  });

  return stats;
};

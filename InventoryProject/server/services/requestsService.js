import { supabase } from "../../db.js";

export const createRequest = async ({ type, details, requested_by }) => {
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

  if (error) throw error;
  return data;
};

export const getRequests = async (filters = {}) => {
  let query = supabase
    .from("requests")
    .select(`
      *,
      users(id, name, username, role)
    `)
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.type) {
    query = query.eq("type", filters.type);
  }

  if (filters.requested_by) {
    query = query.eq("requested_by", filters.requested_by);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
};

export const getPendingRequests = async () => {
  return getRequests({ status: "PENDING" });
};

export const updateRequestStatus = async (id, status) => {
  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Invalid status. Must be PENDING, APPROVED, or REJECTED");
  }

  const { data, error } = await supabase
    .from("requests")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getRequestStats = async () => {
  const { data, error } = await supabase
    .from("requests")
    .select("status, type");

  if (error) throw error;

  const stats = {
    total: data.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    byType: {}
  };

  data.forEach(req => {
    stats[req.status.toLowerCase()]++;
    if (!stats.byType[req.type]) {
      stats.byType[req.type] = 0;
    }
    stats.byType[req.type]++;
  });

  return stats;
};

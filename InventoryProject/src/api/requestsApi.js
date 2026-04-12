const API_BASE = "http://localhost:5000/api";

export const createRequest = async (request) => {
  const res = await fetch(`${API_BASE}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  if (!res.ok) throw new Error("Failed to create request");
  return res.json();
};

export const getRequests = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append("status", filters.status);
  if (filters.type) params.append("type", filters.type);
  if (filters.requested_by) params.append("requested_by", filters.requested_by);

  const res = await fetch(`${API_BASE}/requests?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
};

export const getPendingRequests = async () => {
  const res = await fetch(`${API_BASE}/requests/pending`);
  if (!res.ok) throw new Error("Failed to fetch pending requests");
  return res.json();
};

export const getRequestStats = async () => {
  const res = await fetch(`${API_BASE}/requests/stats`);
  if (!res.ok) throw new Error("Failed to fetch request stats");
  return res.json();
};

export const updateRequestStatus = async (id, status) => {
  const res = await fetch(`${API_BASE}/requests/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("Failed to update request status");
  return res.json();
};

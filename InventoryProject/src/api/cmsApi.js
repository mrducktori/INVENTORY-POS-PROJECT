import { apiCall } from "./client.js";

export async function getCmsContent() {
  return apiCall("/cms", {
    method: "GET"
  });
}

export async function updateCmsContent(section_key, updates) {
  return apiCall(`/cms/${section_key}`, {
    method: "PUT",
    body: JSON.stringify(updates)
  });
}

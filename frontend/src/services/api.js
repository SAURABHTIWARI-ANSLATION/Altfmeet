import { API_BASE_URL } from "./config";
import { getAuthToken } from "./authToken";

async function authHeaders(extraHeaders = {}) {
  const token = await getAuthToken();
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : { error: await response.text() };

  if (!response.ok) {
    const message = payload?.error || payload?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export const api = {
  createMeeting: async (hostId, title) => {
    const response = await fetch(`${API_BASE_URL}/meetings/create-meeting`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ hostId, title }),
    });
    return parseApiResponse(response);
  },
  joinMeeting: async (meetingId, userId) => {
    const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/join`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ userId }),
    });
    return parseApiResponse(response);
  },
  getMeetingDetails: async (meetingId) => {
    const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}`, {
      headers: await authHeaders(),
    });
    return parseApiResponse(response);
  },
  getIceServers: async () => {
    const response = await fetch(`${API_BASE_URL}/ice-servers`, {
      headers: await authHeaders(),
    });
    return parseApiResponse(response);
  },
};

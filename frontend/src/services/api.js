import { API_BASE_URL } from "./config";
import { getAuthToken } from "./authToken";

async function authHeaders(extraHeaders = {}) {
  const token = await getAuthToken();
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}

export const api = {
  createMeeting: async (hostId, title) => {
    const response = await fetch(`${API_BASE_URL}/meetings/create-meeting`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ hostId, title }),
    });
    return response.json();
  },
  joinMeeting: async (meetingId, userId) => {
    const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/join`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ userId }),
    });
    return response.json();
  },
  getMeetingDetails: async (meetingId) => {
    const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}`, {
      headers: await authHeaders(),
    });
    return response.json();
  },
  getIceServers: async () => {
    const response = await fetch(`${API_BASE_URL}/ice-servers`, {
      headers: await authHeaders(),
    });
    return response.json();
  },
};

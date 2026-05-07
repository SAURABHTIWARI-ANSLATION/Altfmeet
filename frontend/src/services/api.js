import { API_BASE_URL } from "./config";

export const api = {
  createMeeting: async (hostId, title) => {
    const response = await fetch(`${API_BASE_URL}/meetings/create-meeting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId, title }),
    });
    return response.json();
  },
  joinMeeting: async (meetingId, userId) => {
    const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    return response.json();
  },
  getMeetingDetails: async (meetingId) => {
    const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}`);
    return response.json();
  },
};

const API_BASE_URL = "http://localhost:5000/api";

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

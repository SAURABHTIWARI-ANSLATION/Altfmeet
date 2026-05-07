const DEFAULT_BACKEND_URL = import.meta.env.DEV
  ? "http://localhost:5000"
  : "https://altfmeet.onrender.com";

export const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL
).replace(/\/+$/, "");

export const API_BASE_URL = `${BACKEND_URL}/api`;

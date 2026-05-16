const DEFAULT_SERVER_ORIGIN = "http://localhost:3001";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");
const getBrowserOrigin = () => {
  if (typeof window === "undefined") return "";
  return trimTrailingSlash(window.location?.origin || "");
};

export const getServerOrigin = () => {
  const fromEnv = trimTrailingSlash(import.meta.env?.VITE_SERVER_ORIGIN || "");
  if (fromEnv) return fromEnv;
  if (import.meta.env?.PROD) return getBrowserOrigin();
  return DEFAULT_SERVER_ORIGIN;
};

export const resolveAssetUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^(https?:\/\/|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("/uploads/")) return `${getServerOrigin()}${raw}`;
  if (raw.startsWith("uploads/")) return `${getServerOrigin()}/${raw}`;
  return raw;
};

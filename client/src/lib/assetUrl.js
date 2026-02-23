const DEFAULT_SERVER_ORIGIN = "http://localhost:3001";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const getServerOrigin = () => {
  const fromEnv = trimTrailingSlash(import.meta.env?.VITE_SERVER_ORIGIN || "");
  if (fromEnv) return fromEnv;
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

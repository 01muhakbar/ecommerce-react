import { useEffect, useState } from "react";

const normalizeStoredBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const readStoredBoolean = (storageKey, fallback) => {
  if (typeof window === "undefined") return fallback;
  return normalizeStoredBoolean(window.localStorage.getItem(storageKey), fallback);
};

export default function useStoredBoolean(storageKey, defaultValue = false) {
  const [value, setValue] = useState(() => readStoredBoolean(storageKey, defaultValue));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, String(Boolean(value)));
  }, [storageKey, value]);

  return [value, setValue];
}

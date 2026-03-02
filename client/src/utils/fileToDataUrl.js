const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_FILE_SIZE = 500 * 1024;

export const validateCustomizationLogoFile = (file) => {
  if (!file) return { valid: false, error: "No file selected." };
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return {
      valid: false,
      error: "Only *.jpeg, *.webp and *.png images will be accepted",
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "Max 500KB" };
  }
  return { valid: true, error: "" };
};

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });

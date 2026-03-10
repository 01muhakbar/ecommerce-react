const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_DIMENSION = 1200;
const TARGET_OUTPUT_BYTES = 900 * 1024;
const HARD_OUTPUT_BYTES = 2 * 1024 * 1024;
export const QRIS_RECOMMENDED_UPLOAD_BYTES = 2 * 1024 * 1024;
export const QRIS_WARNING_UPLOAD_BYTES = 2 * 1024 * 1024;
export const QRIS_EARLY_REJECT_UPLOAD_BYTES = 10 * 1024 * 1024;
const JPEG_QUALITY_STEPS = [0.92, 0.86, 0.8];

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read QRIS image."));
    reader.readAsDataURL(file);
  });

const loadImage = (dataUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode QRIS image."));
    image.src = dataUrl;
  });

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to prepare QRIS preview."));
    reader.readAsDataURL(blob);
  });

const canvasToBlob = (canvas, mimeType, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to optimize QRIS image."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });

const clampDimensions = (width, height) => {
  if (!width || !height) return { width: 0, height: 0 };
  const scale = Math.min(1, MAX_DIMENSION / width, MAX_DIMENSION / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const formatBytes = (bytes) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
};

export const getQrisUploadGuard = (file) => {
  if (!file) {
    return {
      level: "error",
      message: "QRIS image is required.",
    };
  }
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return {
      level: "error",
      message: "Use a PNG, JPEG, or WebP image for QRIS.",
    };
  }
  const size = Number(file.size || 0);
  if (size > QRIS_EARLY_REJECT_UPLOAD_BYTES) {
    return {
      level: "error",
      message: `This file is too large to process safely. Use an image under ${formatBytes(
        QRIS_EARLY_REJECT_UPLOAD_BYTES
      )}.`,
    };
  }
  if (size > QRIS_WARNING_UPLOAD_BYTES) {
    return {
      level: "warning",
      message: `This file is quite large. The app will optimize it before upload.`,
    };
  }
  return {
    level: "ok",
    message: "",
  };
};

export async function optimizeQrisImage(file) {
  if (!file) {
    throw new Error("QRIS image is required.");
  }
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use a PNG, JPEG, or WebP image for QRIS.");
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const originalWidth = Number(image.naturalWidth || image.width || 0);
  const originalHeight = Number(image.naturalHeight || image.height || 0);

  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new Error("QRIS image dimensions are invalid.");
  }

  const { width, height } = clampDimensions(originalWidth, originalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available in this browser.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const isPng = file.type === "image/png";
  let bestBlob = null;
  let bestMimeType = file.type === "image/webp" ? "image/webp" : file.type === "image/jpeg" ? "image/jpeg" : "image/png";

  if (isPng) {
    bestBlob = await canvasToBlob(canvas, "image/png");
    bestMimeType = "image/png";
  } else {
    for (const quality of JPEG_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, bestMimeType, quality);
      bestBlob = blob;
      if (blob.size <= TARGET_OUTPUT_BYTES) {
        break;
      }
    }
  }

  if (!bestBlob) {
    throw new Error("Failed to optimize QRIS image.");
  }

  const optimizedSize = Number(bestBlob.size || 0);
  if (optimizedSize > HARD_OUTPUT_BYTES) {
    throw new Error(
      "Optimized QRIS image is still too large. Please use a smaller or cleaner image."
    );
  }

  const dataUrl = await blobToDataUrl(bestBlob);
  return {
    dataUrl,
    mimeType: bestMimeType,
    width,
    height,
    originalSize: Number(file.size || 0),
    optimizedSize,
    optimized: optimizedSize < Number(file.size || 0) || width !== originalWidth || height !== originalHeight,
    originalWidth,
    originalHeight,
  };
}

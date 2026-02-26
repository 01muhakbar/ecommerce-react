import { useEffect, useMemo, useState } from "react";
import { Star, X } from "lucide-react";

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

const normalizeImageUrls = (images) => {
  if (!Array.isArray(images)) return [];
  return images
    .map((image) => String(image || "").trim())
    .filter(Boolean)
    .slice(0, MAX_IMAGES);
};

export default function ReviewModal({
  open,
  product,
  review,
  onClose,
  onSubmit,
  isSubmitting = false,
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [existingImages, setExistingImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRating(Number(review?.rating) || 0);
    setComment(String(review?.comment || ""));
    setExistingImages(normalizeImageUrls(review?.images));
    setNewFiles([]);
    setError("");
    setImageError("");
  }, [open, review]);

  const title = useMemo(() => `Review for ${product?.name || "Product"}`, [product?.name]);

  const newFilePreviews = useMemo(
    () => newFiles.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    [newFiles]
  );

  useEffect(
    () => () => {
      newFilePreviews.forEach((entry) => URL.revokeObjectURL(entry.preview));
    },
    [newFilePreviews]
  );

  if (!open) return null;

  const remainingSlots = Math.max(0, MAX_IMAGES - existingImages.length - newFiles.length);
  const canSubmit = rating >= 1 && comment.trim().length >= 3 && !isSubmitting;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget && !isSubmitting) {
      onClose?.();
    }
  };

  const handleFileChange = (event) => {
    const selected = Array.from(event.target.files || []);
    if (event.target) {
      event.target.value = "";
    }
    if (selected.length === 0) return;

    const validFiles = [];
    for (const file of selected) {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        setImageError("Only .jpeg and .png files are allowed.");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError("Image too large (max 2MB each).");
        return;
      }
      validFiles.push(file);
    }

    setImageError("");
    if (remainingSlots <= 0) {
      setImageError("Maximum 4 images.");
      return;
    }

    const nextFiles = validFiles.slice(0, remainingSlots);
    setNewFiles((prev) => [...prev, ...nextFiles]);
    if (validFiles.length > nextFiles.length) {
      setImageError("Maximum 4 images.");
    }
  };

  const handleRemoveExisting = (index) => {
    if (isSubmitting) return;
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNew = (index) => {
    if (isSubmitting) return;
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (rating < 1) {
      setError("Please select a rating.");
      return;
    }
    if (comment.trim().length < 3) {
      setError("Please write at least 3 characters.");
      return;
    }
    setError("");
    onSubmit?.({
      rating,
      comment: comment.trim(),
      existingImages,
      newFiles,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:items-center sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:my-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500 text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto px-6 py-6">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-600">Rating</p>
            <div className="mt-3 flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, idx) => {
                const value = idx + 1;
                const isActive = value <= rating;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="rounded-full p-1"
                    aria-label={`Rate ${value} star`}
                    disabled={isSubmitting}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        isActive ? "text-yellow-400" : "text-slate-300"
                      }`}
                      fill={isActive ? "currentColor" : "none"}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-600">Images (Optional)</p>
            <label className="mt-3 flex min-h-[130px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-6 text-center text-sm text-slate-500">
              <input
                type="file"
                accept="image/png, image/jpeg"
                className="hidden"
                multiple
                onChange={handleFileChange}
                disabled={isSubmitting || remainingSlots <= 0}
              />
              <span className="font-medium text-slate-700">
                Upload up to 4 images
              </span>
              <span className="mt-1 text-xs text-slate-400">
                (Only *.jpeg and *.png files are allowed)
              </span>
              <span className="mt-1 text-xs text-slate-400">
                {existingImages.length + newFiles.length}/{MAX_IMAGES} selected
              </span>
            </label>

            {existingImages.length > 0 || newFilePreviews.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {existingImages.map((image, index) => (
                  <div key={`existing-${index}`} className="relative">
                    <img
                      src={image}
                      alt=""
                      className="h-16 w-16 rounded-md object-cover"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src =
                          "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExisting(index)}
                      disabled={isSubmitting}
                      className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {newFilePreviews.map((entry, index) => (
                  <div key={`new-${entry.file.name}-${index}`} className="relative">
                    <img
                      src={entry.preview}
                      alt=""
                      className="h-16 w-16 rounded-md object-cover"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src =
                          "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNew(index)}
                      disabled={isSubmitting}
                      className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {imageError ? <p className="mt-2 text-sm text-rose-600">{imageError}</p> : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-600">
              Write your thoughts
            </p>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              placeholder="Write your thoughts..."
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              disabled={isSubmitting}
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  );
}

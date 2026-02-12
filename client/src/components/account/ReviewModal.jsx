import { useEffect, useMemo, useState } from "react";
import { Star, X } from "lucide-react";

const MAX_IMAGE_BYTES = 400 * 1024;

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function ReviewModal({ open, product, review, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState([]);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRating(review?.rating ?? 0);
    setComment(review?.comment ?? "");
    setImages(Array.isArray(review?.images) ? review.images : []);
    setError("");
    setImageError("");
  }, [open, review]);

  const title = useMemo(
    () => `Review for ${product?.name || "Product"}`,
    [product?.name]
  );

  if (!open) return null;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setImageError("Only .jpeg and .png files are allowed.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image too large (max 400KB).");
      return;
    }
    setImageError("");
    try {
      const dataUrl = await toDataUrl(file);
      setImages([dataUrl]);
    } catch {
      setImageError("Failed to load image.");
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!rating) {
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
      images,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500 text-white transition hover:bg-rose-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
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
            <p className="text-xs font-semibold uppercase text-slate-600">Images</p>
            <label className="mt-3 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
              <input
                type="file"
                accept="image/png, image/jpeg"
                className="hidden"
                onChange={handleFileChange}
              />
              <span className="font-medium text-slate-700">Drag your image here</span>
              <span className="mt-1 text-xs text-slate-400">
                (Only *.jpeg and *.png files are allowed)
              </span>
              {images.length > 0 ? (
                <img
                  src={images[0]}
                  alt="Review preview"
                  className="mt-4 h-20 w-20 rounded-lg object-cover"
                />
              ) : null}
            </label>
            {imageError ? (
              <p className="mt-2 text-sm text-rose-600">{imageError}</p>
            ) : null}
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
            />
          </div>

          {error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Submit Review
          </button>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyStore,
  upsertStorePaymentProfile,
} from "../../api/storePaymentProfiles.ts";
import {
  formatBytes,
  getQrisUploadGuard,
  optimizeQrisImage,
  QRIS_RECOMMENDED_UPLOAD_BYTES,
} from "../../utils/optimizeImageUpload.js";

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const textareaClass = `${inputClass} h-28 py-3`;

const EMPTY_FORM = {
  accountName: "",
  merchantName: "",
  merchantId: "",
  qrisImageUrl: "",
  qrisPayload: "",
  instructionText: "",
};

const toText = (value) => String(value ?? "").trim();

const normalizeForm = (paymentProfile) => ({
  accountName: toText(paymentProfile?.accountName),
  merchantName: toText(paymentProfile?.merchantName),
  merchantId: toText(paymentProfile?.merchantId),
  qrisImageUrl: toText(paymentProfile?.qrisImageUrl),
  qrisPayload: toText(paymentProfile?.qrisPayload),
  instructionText: toText(paymentProfile?.instructionText),
});

const STATUS_STYLES = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-700",
};

export default function AccountStorePaymentProfilePage({ mode = "account" }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [imageMeta, setImageMeta] = useState(null);
  const [uploadNotice, setUploadNotice] = useState(null);

  const storeQuery = useQuery({
    queryKey: ["my-store-payment-profile"],
    queryFn: getMyStore,
  });

  useEffect(() => {
    if (!storeQuery.data?.paymentProfile) {
      setForm(EMPTY_FORM);
      setImageMeta(null);
      setUploadNotice(null);
      return;
    }
    setForm(normalizeForm(storeQuery.data.paymentProfile));
    setImageMeta(null);
    setUploadNotice(null);
  }, [storeQuery.data]);

  const mutation = useMutation({
    mutationFn: ({ storeId, payload }) => upsertStorePaymentProfile(storeId, payload),
    onSuccess: () => {
      setFeedback({
        type: "success",
        message: "Store payment profile saved. Admin review is required before activation.",
      });
      queryClient.invalidateQueries({ queryKey: ["my-store-payment-profile"] });
    },
    onError: (error) => {
      const status = Number(error?.response?.status || 0);
      setFeedback({
        type: "error",
        message:
          (status === 413
            ? "Optimized QRIS image is still too large. Try a smaller file."
            : error?.response?.data?.message) ||
          error?.message ||
          "Failed to save store payment profile.",
      });
    },
  });

  const currentStatus = String(
    storeQuery.data?.paymentProfile?.verificationStatus || "NOT_CONFIGURED"
  ).toUpperCase();
  const statusClass =
    STATUS_STYLES[currentStatus] || "border-slate-200 bg-slate-100 text-slate-700";

  const feedbackClass = useMemo(() => {
    if (!feedback) return "";
    return feedback.type === "success"
      ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      : "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700";
  }, [feedback]);

  const uploadNoticeClass = useMemo(() => {
    if (!uploadNotice) return "";
    if (uploadNotice.type === "warning") {
      return "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800";
    }
    if (uploadNotice.type === "error") {
      return "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700";
    }
    return "rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700";
  }, [uploadNotice]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsReadingFile(true);
    setFeedback(null);
    setUploadNotice(null);
    try {
      const guard = getQrisUploadGuard(file);
      if (guard.level === "error") {
        throw new Error(guard.message);
      }
      if (guard.level === "warning") {
        setUploadNotice({ type: "warning", message: guard.message });
      } else {
        setUploadNotice({
          type: "info",
          message: "Image looks fine. The app will still optimize it before upload.",
        });
      }

      setUploadNotice((current) => ({
        type: current?.type === "warning" ? "warning" : "info",
        message: "Optimizing image before upload...",
      }));
      const optimized = await optimizeQrisImage(file);
      handleChange("qrisImageUrl", optimized.dataUrl);
      setImageMeta(optimized);
      setUploadNotice({
        type: optimized.optimized ? "info" : "info",
        message: `Ready to upload. Final image size is ${formatBytes(
          optimized.optimizedSize
        )}.`,
      });
    } catch (error) {
      setImageMeta(null);
      setUploadNotice({
        type: "error",
        message: error?.message || "Failed to prepare QRIS image.",
      });
      setFeedback({
        type: "error",
        message: error?.message || "Failed to load QRIS image.",
      });
    } finally {
      setIsReadingFile(false);
      event.target.value = "";
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setFeedback(null);

    const storeId = Number(storeQuery.data?.id);
    if (!Number.isFinite(storeId)) {
      setFeedback({
        type: "error",
        message: "No linked store found for this account.",
      });
      return;
    }

    const payload = {
      accountName: toText(form.accountName),
      merchantName: toText(form.merchantName),
      merchantId: toText(form.merchantId) || null,
      qrisImageUrl: toText(form.qrisImageUrl),
      qrisPayload: toText(form.qrisPayload) || null,
      instructionText: toText(form.instructionText) || null,
    };

    if (!payload.accountName || !payload.merchantName || !payload.qrisImageUrl) {
      setFeedback({
        type: "error",
        message: "Account name, merchant name, and QRIS image are required.",
      });
      return;
    }

    mutation.mutate({ storeId, payload });
  };

  const isAdminMode = mode === "admin";
  const contextLabel = isAdminMode ? "Online Store" : "Account";

  if (storeQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Loading store payment profile...
      </div>
    );
  }

  if (storeQuery.isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {storeQuery.error?.response?.data?.message ||
          storeQuery.error?.message ||
          "Failed to load store payment profile."}
      </div>
    );
  }

  if (!storeQuery.data) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-500">{contextLabel}</p>
          <h1 className="text-2xl font-semibold text-slate-900">Store Payment Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            This account does not have a linked store yet.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          A store will be created automatically for seller-owned products during foundation sync.
        </div>
      </div>
    );
  }

  const paymentProfile = storeQuery.data.paymentProfile;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{contextLabel}</p>
          <h1 className="text-2xl font-semibold text-slate-900">Store Payment Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Set up the static QRIS profile for store-level payment activation.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
          {currentStatus === "NOT_CONFIGURED" ? "Not Configured" : currentStatus}
        </span>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Store Name
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">{storeQuery.data.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Store Slug
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">{storeQuery.data.slug}</p>
          </div>
        </div>
      </section>

      {feedback ? <div className={feedbackClass}>{feedback.message}</div> : null}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account Name
            </span>
            <input
              type="text"
              value={form.accountName}
              onChange={(event) => handleChange("accountName", event.target.value)}
              className={inputClass}
              placeholder="Account Name"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Merchant Name
            </span>
            <input
              type="text"
              value={form.merchantName}
              onChange={(event) => handleChange("merchantName", event.target.value)}
              className={inputClass}
              placeholder="Merchant Name"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Merchant ID
            </span>
            <input
              type="text"
              value={form.merchantId}
              onChange={(event) => handleChange("merchantId", event.target.value)}
              className={inputClass}
              placeholder="Optional Merchant ID"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              QRIS Image
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="mt-2 block w-full text-sm text-slate-600"
            />
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              <p>Supported formats: PNG, JPEG, WEBP.</p>
              <p>Recommended size: under {formatBytes(QRIS_RECOMMENDED_UPLOAD_BYTES)}.</p>
              <p>Use a clear QR image that is not blurry. The app will optimize it before upload.</p>
            </div>
            {uploadNotice ? <div className={`mt-2 ${uploadNoticeClass}`}>{uploadNotice.message}</div> : null}
            {imageMeta ? (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p>
                  Original: {formatBytes(imageMeta.originalSize)} ({imageMeta.originalWidth} ×{" "}
                  {imageMeta.originalHeight})
                </p>
                <p>
                  Final: {formatBytes(imageMeta.optimizedSize)} ({imageMeta.width} ×{" "}
                  {imageMeta.height}) • {imageMeta.mimeType.replace("image/", "").toUpperCase()}
                </p>
              </div>
            ) : null}
          </label>
          <label className="block lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              QRIS Payload
            </span>
            <textarea
              value={form.qrisPayload}
              onChange={(event) => handleChange("qrisPayload", event.target.value)}
              className={textareaClass}
              placeholder="Optional raw payload or provider metadata"
            />
          </label>
          <label className="block lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Instruction Text
            </span>
            <textarea
              value={form.instructionText}
              onChange={(event) => handleChange("instructionText", event.target.value)}
              className={textareaClass}
              placeholder="Payment instructions shown for this store later"
            />
          </label>
        </div>

        {form.qrisImageUrl ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              QRIS Preview
            </p>
            {imageMeta ? (
              <p className="mt-2 text-xs text-slate-500">
                Preview below uses the optimized image that will be sent to the backend.
              </p>
            ) : null}
            <img
              src={form.qrisImageUrl}
              alt="QRIS preview"
              className="mt-3 max-h-64 rounded-xl border border-slate-200 bg-white object-contain p-2"
            />
          </div>
        ) : null}

        {paymentProfile ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Current status:{" "}
            <span className="font-semibold text-slate-900">
              {paymentProfile.verificationStatus}
            </span>
            . Saving changes will reset the profile to <span className="font-semibold">PENDING</span>
            {" "}until reviewed by admin.
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending || isReadingFile}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? "Saving..." : paymentProfile ? "Update Profile" : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

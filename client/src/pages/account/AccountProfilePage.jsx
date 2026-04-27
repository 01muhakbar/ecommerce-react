import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/axios.ts";
import { getStoreCustomization } from "../../api/public/storeCustomizationPublic.ts";
import { normalizeDashboardSettingCopy } from "../../utils/dashboardSettingCopy.js";
import { useAccountAuth } from "../../auth/authDomainHooks.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { uploadUserProfileImage } from "../../api/userMe.ts";

const fetchMe = async () => {
  const { data } = await api.get("/auth/account/me");
  return data;
};

const updateProfile = async (payload) => {
  const { data } = await api.put("/store/profile", payload);
  return data;
};

export default function AccountProfilePage() {
  const qc = useQueryClient();
  const { refreshSession } = useAccountAuth();
  const fileInputRef = useRef(null);
  const dashboardSettingQuery = useQuery({
    queryKey: ["store-customization", "dashboard-setting", "en"],
    queryFn: () => getStoreCustomization({ lang: "en", include: "dashboardSetting" }),
    staleTime: 60_000,
  });
  const dashboardSettingCopy = normalizeDashboardSettingCopy(
    dashboardSettingQuery.data?.customization?.dashboardSetting
  );
  const profileCopy = dashboardSettingCopy.updateProfile;
  const { data, isLoading } = useQuery({
    queryKey: ["account", "me"],
    queryFn: fetchMe,
  });
  const user = data?.data?.user;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setAvatarUrl(String(user.avatarUrl || user.avatar || ""));
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      setStatus({ type: "success", message: "Profile updated." });
      await qc.invalidateQueries({ queryKey: ["account", "me"] });
      await refreshSession?.();
    },
    onError: () => {
      setStatus({ type: "error", message: "Failed to update profile." });
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus(null);
    mutation.mutate({ name, email, avatarUrl: avatarUrl || null });
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus(null);
    try {
      const nextUrl = await uploadUserProfileImage(file);
      setAvatarUrl(nextUrl);
      setStatus({ type: "success", message: "Profile image uploaded. Save to persist the change." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.response?.data?.message || error?.message || "Failed to upload profile image.",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const avatarSrc = resolveAssetUrl(avatarUrl || "");

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading profile...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleAvatarUpload}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {profileCopy.sectionTitleValue}
        </h1>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Profile Image
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-400">
            {avatarSrc ? (
              <img src={avatarSrc} alt={name || email || "Profile avatar"} className="h-full w-full object-cover" />
            ) : (
              "UP"
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || mutation.isPending}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              {uploading ? "Uploading..." : avatarSrc ? "Replace image" : "Upload image"}
            </button>
            <button
              type="button"
              onClick={() => setAvatarUrl("")}
              disabled={uploading || mutation.isPending || !avatarUrl}
              className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
            >
              Remove image
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {profileCopy.fullNameLabel}
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder={profileCopy.fullNameLabel}
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {profileCopy.emailAddressLabel}
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder={profileCopy.emailAddressLabel}
        />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Shipping Address
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Manage default shipping, store, and return addresses.
        </p>
        <Link
          to="/user/shipping-address"
          className="mt-2 inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Manage Shipping Address
        </Link>
      </div>

      {status && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {status.message}
        </div>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
      >
        {mutation.isPending ? "Saving..." : profileCopy.updateButtonValue}
      </button>
    </form>
  );
}

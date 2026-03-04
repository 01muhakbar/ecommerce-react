import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUserMe, updateUserMe } from "../../api/userMe.ts";
import { getDefaultAddress } from "../../api/userAddresses.ts";

const safeText = (value, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

export default function AccountMyAccountPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadAccountData = async (withLoading = true) => {
    if (withLoading) setIsLoading(true);
    setError("");
    try {
      const [meData, defaultAddressData] = await Promise.all([
        getUserMe(),
        getDefaultAddress().catch(() => null),
      ]);
      setProfile(meData);
      setName(String(meData?.name || ""));
      setPhone(String(meData?.phone || ""));
      setDefaultAddress(defaultAddressData);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load account profile.");
    } finally {
      if (withLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccountData();
  }, []);

  const handleEdit = () => {
    setStatus(null);
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setStatus(null);
    setName(String(profile?.name || ""));
    setPhone(String(profile?.phone || ""));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const nextName = String(name || "").trim();
    if (!nextName) {
      setStatus({ type: "error", message: "Name is required." });
      return;
    }

    setIsSaving(true);
    setStatus(null);
    try {
      const updated = await updateUserMe({
        name: nextName,
        phone: String(phone || "").trim(),
      });
      setProfile(updated);
      setName(String(updated?.name || ""));
      setPhone(String(updated?.phone || ""));
      setIsEditMode(false);
      setStatus({ type: "success", message: "Profile updated successfully." });
      await loadAccountData(false);
    } catch (requestError) {
      setStatus({
        type: "error",
        message: requestError?.response?.data?.message || "Failed to update profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const shippingAddressSummary = defaultAddress
    ? [
        `${defaultAddress.streetName || ""} ${defaultAddress.houseNumber || ""}`.trim(),
        defaultAddress.building || "",
        defaultAddress.district || "",
        defaultAddress.city || "",
        defaultAddress.province || "",
        defaultAddress.postalCode || "",
      ]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(", ")
    : "";

  const editAddressHref = defaultAddress?.id
    ? `/user/shipping-address?id=${encodeURIComponent(defaultAddress.id)}`
    : "/user/shipping-address";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Account overview and basic profile information.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Loading account...
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && profile ? (
        <div className="space-y-4">
          <form
            onSubmit={handleSave}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Profile Information</p>
              {!isEditMode ? (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Edit
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</p>
                {isEditMode ? (
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="mt-2 text-sm font-medium text-slate-900">{safeText(profile?.name)}</p>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{safeText(profile?.email)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                {isEditMode ? (
                  <input
                    type="text"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {safeText(profile?.phone, "Not set")}
                  </p>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {safeText(profile?.address, "Not set")}
                </p>
              </div>
            </div>

            {status ? (
              <div
                className={`mx-4 mb-4 rounded-lg border px-3 py-2 text-sm ${
                  status.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {status.message}
              </div>
            ) : null}

            {isEditMode ? (
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            ) : null}
          </form>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Default Shipping Address</p>
              <Link
                to={editAddressHref}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Edit
              </Link>
            </div>
            {!defaultAddress ? (
              <div className="p-4">
                <p className="text-sm text-slate-600">No primary shipping address set yet.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Add one in Shipping Address to use as default delivery address.
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {safeText(defaultAddress.fullName)}
                </p>
                <p className="text-sm text-slate-700">
                  {safeText(defaultAddress.phoneNumber, "-")}
                </p>
                <p className="text-sm text-slate-700">{safeText(shippingAddressSummary, "-")}</p>
                <div className="flex items-center gap-2 pt-1 text-[11px]">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                    Primary
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                    {safeText(defaultAddress.markAs, "HOME")}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

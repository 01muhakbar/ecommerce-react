import { useEffect, useState } from "react";
import { getAdminMe, updateAdminMe } from "../../api/adminProfile.ts";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
};

export default function AdminProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminMe();
      setForm({
        name: String(data?.name || ""),
        email: String(data?.email || ""),
        phone: String(data?.phone || ""),
      });
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to load profile.";
      setError(String(message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updateAdminMe({
        name: form.name,
        phone: form.phone || null,
      });
      setForm((prev) => ({
        ...prev,
        name: String(updated?.name || prev.name),
        email: String(updated?.email || prev.email),
        phone: String(updated?.phone || ""),
      }));
      setSuccess("Profile updated successfully.");
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to update profile.";
      setError(String(message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Loading profile...
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Edit Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update your admin profile information.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
          <input
            type="text"
            value={form.name}
            onChange={handleChange("name")}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={form.email}
            readOnly
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Phone</span>
          <input
            type="text"
            value={form.phone}
            onChange={handleChange("phone")}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
            placeholder="Optional"
          />
        </label>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:border-slate-300"
            onClick={loadProfile}
            disabled={saving}
          >
            Reload
          </button>
        </div>
      </form>
    </section>
  );
}

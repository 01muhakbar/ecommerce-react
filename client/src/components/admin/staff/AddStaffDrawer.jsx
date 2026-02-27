import { useEffect, useState } from "react";
import { ImagePlus, UploadCloud, X } from "lucide-react";
import { GENERIC_ERROR } from "../../../constants/uiMessages.js";

const roleOptions = [
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

const accessOptions = [
  { value: "dashboard", label: "Dashboard" },
  { value: "catalog", label: "Catalog" },
  { value: "orders", label: "Orders" },
  { value: "customers", label: "Customers" },
  { value: "our-staff", label: "Our Staff" },
];

const getTodayDateValue = () => new Date().toISOString().slice(0, 10);

const initialForm = {
  language: "en",
  name: "",
  email: "",
  password: "",
  contactNumber: "",
  joiningDate: getTodayDateValue(),
  role: "staff",
  routesAccess: [],
};

export default function AddStaffDrawer({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  defaultRole = "staff",
}) {
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({ ...initialForm, role: defaultRole || prev.role || "staff" }));
    setImageFile(null);
    setImagePreview("");
    setValidationError("");
  }, [open, defaultRole]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const submitError = validationError || error || "";

  const setField = (patch) => {
    setValidationError("");
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const toggleRouteAccess = (route) => {
    setValidationError("");
    setForm((prev) => {
      const hasValue = prev.routesAccess.includes(route);
      return {
        ...prev,
        routesAccess: hasValue
          ? prev.routesAccess.filter((value) => value !== route)
          : [...prev.routesAccess, route],
      };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password;
    const role = form.role;

    if (!name || !email || !password || !role) {
      setValidationError("Name, email, password, and role are required.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setValidationError("Please enter a valid email.");
      return;
    }
    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters.");
      return;
    }

    onSubmit({
      name,
      email,
      password,
      role,
      isActive: true,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        onClick={() => !isSubmitting && onClose()}
        aria-label="Close add staff drawer"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[620px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Add Staff</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add your staff necessary information from here
              </p>
            </div>
            <button
              type="button"
              onClick={() => !isSubmitting && onClose()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close drawer"
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 max-w-[220px]">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Language
            </label>
            <select
              value={form.language}
              onChange={(event) => setField({ language: event.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
              disabled={isSubmitting}
            >
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Staff Image
              </label>
              <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-emerald-400 hover:bg-emerald-50/40">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
                {imagePreview ? (
                  <div className="space-y-3">
                    <img
                      src={imagePreview}
                      alt="Staff preview"
                      className="h-28 w-full rounded-xl object-cover"
                    />
                    <p className="text-xs text-slate-500">{imageFile?.name}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <ImagePlus className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-medium">Upload staff image (UI only)</p>
                      <p className="text-xs text-slate-500">PNG/JPG, local preview only</p>
                    </div>
                    <UploadCloud className="ml-auto h-5 w-5 text-slate-400" />
                  </div>
                )}
              </label>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Name
              </label>
              <input
                value={form.name}
                onChange={(event) => setField({ name: event.target.value })}
                placeholder="Staff name"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setField({ email: event.target.value })}
                placeholder="staff@example.com"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setField({ password: event.target.value })}
                placeholder="Minimum 6 characters"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contact Number
              </label>
              <input
                value={form.contactNumber}
                onChange={(event) => setField({ contactNumber: event.target.value })}
                placeholder="+62..."
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Joining Date
              </label>
              <input
                type="date"
                value={form.joiningDate}
                onChange={(event) => setField({ joiningDate: event.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Staff Role
              </label>
              <select
                value={form.role}
                onChange={(event) => setField({ role: event.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                disabled={isSubmitting}
                required
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Select Routes to given Access
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {accessOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={form.routesAccess.includes(option.value)}
                      onChange={() => toggleRouteAccess(option.value)}
                      disabled={isSubmitting}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {submitError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {submitError || GENERIC_ERROR}
              </div>
            ) : null}
          </div>

          <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => !isSubmitting && onClose()}
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:border-slate-300"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add Staff"}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}

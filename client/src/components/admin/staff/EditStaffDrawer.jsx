import { useEffect, useState } from "react";
import { ImagePlus, LockKeyhole, ShieldCheck, UploadCloud, X } from "lucide-react";
import PasswordStrengthIndicator from "../../auth/PasswordStrengthIndicator.jsx";
import PasswordVisibilityButton from "../../auth/PasswordVisibilityButton.jsx";
import { GENERIC_ERROR } from "../../../constants/uiMessages.js";
import { resolveAssetUrl } from "../../../lib/assetUrl.js";
import {
  PASSWORD_CONFIRM_HELPER,
  PASSWORD_RULES_HELPER,
} from "../../../utils/authUi.js";
import {
  getSellerPreset,
  normalizePermissionKeys,
  SELLER_PERMISSION_GROUPS,
  SELLER_ROLE_PRESETS,
  STAFF_IMAGE_UPLOAD_GUIDANCE,
} from "./staffAccessConfig.js";

const fallbackRoleOptions = [
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
  { value: "seller", label: "Seller" },
];

const sectionCardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";

const toText = (value) => String(value ?? "").trim();
const toRoleValue = (value) => toText(value).toLowerCase().replace(/\s+/g, "_");

const formatRoleLabel = (value) => {
  const text = toText(value);
  if (!text) return "-";
  return text
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const truncateFileName = (value, maxLength = 36) => {
  const text = toText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
};

const defaultSellerPreset = getSellerPreset(SELLER_ROLE_PRESETS[0]?.value);

const initialForm = {
  language: "en",
  name: "",
  email: "",
  password: "",
  passwordConfirm: "",
  phoneNumber: "",
  role: "staff",
  isActive: true,
  sellerRoleCode: defaultSellerPreset?.value || "CATALOG_MANAGER",
  permissionKeys: defaultSellerPreset?.permissionKeys || [],
  avatarUrl: "",
};

const isStrongPassword = (value) =>
  String(value || "").length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

export default function EditStaffDrawer({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  staff,
  rolesOptions = [],
  canManageRoles = true,
  currentUser = null,
}) {
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [validationError, setValidationError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);

  useEffect(() => {
    if (!open || !staff) return;
    const normalizedRole = toRoleValue(staff.role) || "staff";
    const preset = getSellerPreset(staff?.sellerRoleCode || defaultSellerPreset?.value);
    setForm({
      language: "en",
      name: toText(staff.name),
      email: toText(staff.email),
      password: "",
      passwordConfirm: "",
      phoneNumber: toText(staff.phoneNumber ?? staff.phone),
      role: normalizedRole,
      isActive: staff.isActive !== false,
      sellerRoleCode: preset?.value || defaultSellerPreset?.value || "CATALOG_MANAGER",
      permissionKeys:
        normalizedRole === "seller"
          ? normalizePermissionKeys(staff?.permissionKeys?.length ? staff.permissionKeys : preset?.permissionKeys)
          : [],
      avatarUrl: resolveAssetUrl(toText(staff.avatarUrl)),
    });
    setImageFile(null);
    setImagePreview("");
    setValidationError("");
    setPasswordVisible(false);
    setPasswordConfirmVisible(false);
  }, [open, staff]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const isSellerRole = form.role === "seller";
  const isPendingApproval = toText(staff?.status).toLowerCase() === "pending_approval";
  const isEditingOwnAccount =
    Number(currentUser?.id || 0) > 0 &&
    Number(staff?.id || 0) > 0 &&
    Number(currentUser?.id) === Number(staff?.id);
  const isOwnManagedAccount =
    isEditingOwnAccount &&
    ["staff", "admin", "super_admin", "superadmin"].includes(toRoleValue(currentUser?.role));
  const isOwnSuperAdminAccount =
    isEditingOwnAccount &&
    toRoleValue(currentUser?.role) === "super_admin" &&
    toRoleValue(staff?.role) === "super_admin";
  const submitError = validationError || error || "";
  const normalizedRoleOptions =
    rolesOptions.length > 0
      ? rolesOptions.map((role) => ({ value: toRoleValue(role), label: formatRoleLabel(role) }))
      : fallbackRoleOptions;
  const currentRoleOption =
    normalizedRoleOptions.find((role) => toRoleValue(role.value) === toRoleValue(form.role)) ||
    fallbackRoleOptions.find((role) => toRoleValue(role.value) === toRoleValue(form.role)) || {
      value: form.role,
      label: formatRoleLabel(form.role),
    };
  const roleSelectDisabled = isSubmitting || !canManageRoles || isOwnSuperAdminAccount;

  const setField = (patch) => {
    setValidationError("");
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const applySellerPreset = (presetCode) => {
    const preset = getSellerPreset(presetCode);
    setField({
      sellerRoleCode: preset.value,
      permissionKeys: [...preset.permissionKeys],
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setValidationError("");
  };

  const togglePermission = (permissionKey) => {
    setValidationError("");
    setForm((prev) => {
      const nextKeys = prev.permissionKeys.includes(permissionKey)
        ? prev.permissionKeys.filter((entry) => entry !== permissionKey)
        : [...prev.permissionKeys, permissionKey];
      return {
        ...prev,
        permissionKeys: normalizePermissionKeys(nextKeys),
      };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password.trim();
    const passwordConfirm = form.passwordConfirm.trim();

    if (!name || !email) {
      setValidationError("Name and email are required.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setValidationError("Please enter a valid email.");
      return;
    }
    if (password && !isStrongPassword(password)) {
      setValidationError(PASSWORD_RULES_HELPER);
      return;
    }
    if (password && password !== passwordConfirm) {
      setValidationError("Password confirmation does not match.");
      return;
    }
    if (isSellerRole && form.permissionKeys.length === 0) {
      setValidationError("Select at least one seller permission.");
      return;
    }

    onSubmit({
      name,
      email,
      phoneNumber: form.phoneNumber.trim() || null,
      role: form.role,
      isActive: Boolean(form.isActive),
      image: imageFile,
      sellerRoleCode: isSellerRole ? form.sellerRoleCode : null,
      permissionKeys: isSellerRole ? normalizePermissionKeys(form.permissionKeys) : [],
      ...(password ? { password } : {}),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        onClick={() => !isSubmitting && onClose()}
        aria-label="Close update account drawer"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[680px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Admin / Accounts / Edit
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Update Account
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update profile image, contact data, role, access status, and password for this workspace account.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={form.language}
                onChange={(event) => setField({ language: event.target.value })}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"
                disabled={isSubmitting}
              >
                <option value="en">English</option>
                <option value="id">Bahasa Indonesia</option>
              </select>
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
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <section className={sectionCardClass}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Profile Image</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Formats {STAFF_IMAGE_UPLOAD_GUIDANCE.formats}. Recommended{" "}
                    {STAFF_IMAGE_UPLOAD_GUIDANCE.recommendedSize}, minimum{" "}
                    {STAFF_IMAGE_UPLOAD_GUIDANCE.minimumSize}, {STAFF_IMAGE_UPLOAD_GUIDANCE.aspectRatio},
                    max {STAFF_IMAGE_UPLOAD_GUIDANCE.maxSize}.
                  </p>
                </div>
                <label className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                  <UploadCloud className="h-4 w-4" />
                  Replace
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[220px,1fr]">
                <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                  <div className="aspect-square w-full">
                    {imagePreview || form.avatarUrl ? (
                      <img
                        src={imagePreview || form.avatarUrl}
                        alt="Staff preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <ImagePlus className="h-5 w-5" />
                        </span>
                        <p className="text-xs font-medium text-slate-500">No image selected</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Preview
                    </p>
                    <p className="text-sm font-medium text-slate-800">
                      {imageFile
                        ? truncateFileName(imageFile.name)
                        : form.avatarUrl
                          ? "Current saved image"
                          : "Square avatar preview will appear here."}
                    </p>
                    <p className="text-xs leading-5 text-slate-500">
                      The saved image returns in the staff list and edit form after update.
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">
                    Keep the main subject centered so the row avatar stays clear in compact tables.
                  </p>
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <h3 className="text-base font-semibold text-slate-900">Basic Info</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </label>
                  <input
                    id="admin-edit-staff-name"
                    value={form.name}
                    onChange={(event) => setField({ name: event.target.value })}
                    placeholder="Staff name"
                    className={fieldClass}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </label>
                  <input
                    id="admin-edit-staff-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setField({ email: event.target.value })}
                    placeholder="staff@example.com"
                    className={fieldClass}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact Number
                  </label>
                  <input
                    id="admin-edit-staff-phone"
                    value={form.phoneNumber}
                    onChange={(event) => setField({ phoneNumber: event.target.value })}
                    placeholder="+62..."
                    className={fieldClass}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <h3 className="text-base font-semibold text-slate-900">Role & Access</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <label
                          htmlFor="admin-edit-account-role"
                          className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700"
                        >
                          Account Role
                        </label>
                        <select
                          id="admin-edit-account-role"
                          value={form.role}
                          onChange={(event) => {
                            const nextRole = toRoleValue(event.target.value) || "staff";
                            const nextPreset = getSellerPreset(defaultSellerPreset?.value);
                            setField({
                              role: nextRole,
                              sellerRoleCode: nextRole === "seller"
                                ? nextPreset?.value || "CATALOG_MANAGER"
                                : nextPreset?.value || "CATALOG_MANAGER",
                              permissionKeys:
                                nextRole === "seller"
                                  ? [...(nextPreset?.permissionKeys || [])]
                                  : [],
                            });
                          }}
                          className={`${fieldClass} mt-2`}
                          disabled={roleSelectDisabled}
                        >
                          {normalizedRoleOptions.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs leading-5 text-sky-800">
                        {isOwnSuperAdminAccount
                          ? "Your own Super Admin account cannot be lowered from this flow. Use another Super Admin account if a role transfer is intentionally required."
                          : form.role === "seller"
                          ? "Seller accounts stay outside /admin/login and use seller workspace access presets below."
                          : `This account currently uses the ${currentRoleOption.label} workspace role. Feature-level menu permissions are not part of this flow.`}
                      </p>
                    </div>
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span>Status Active</span>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setField({ isActive: event.target.checked })}
                    disabled={isSubmitting || isPendingApproval || isOwnManagedAccount}
                  />
                </label>
                {isPendingApproval ? (
                  <p className="text-xs text-amber-700">
                    This staff account is waiting for approval. Use the approve action from All Accounts to activate sign-in access.
                  </p>
                ) : null}
                {isOwnManagedAccount ? (
                  <p className="text-xs text-amber-700">
                    Your own account cannot be deactivated from this flow because it would immediately remove your workspace access.
                  </p>
                ) : null}

                {isSellerRole ? (
                  <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-amber-900">Seller workspace access</p>
                      <p className="text-xs leading-5 text-amber-800">
                        Seller accounts stay limited to seller workspace lanes. Admin review, publish,
                        categories, staff, and global settings remain outside seller authority, and
                        seller accounts still cannot sign in at /admin/login.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Seller Preset
                      </label>
                      <select
                        value={form.sellerRoleCode}
                        onChange={(event) => applySellerPreset(event.target.value)}
                        className={fieldClass}
                        disabled={isSubmitting}
                      >
                        {SELLER_ROLE_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">
                        {getSellerPreset(form.sellerRoleCode)?.description}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {SELLER_PERMISSION_GROUPS.map((group) => (
                        <div key={group.id} className="rounded-2xl border border-white/70 bg-white/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {group.title}
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {group.permissions.map((permission) => (
                              <label
                                key={permission.value}
                                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={form.permissionKeys.includes(permission.value)}
                                  onChange={() => togglePermission(permission.value)}
                                  disabled={isSubmitting}
                                />
                                <span>{permission.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                    Access rules follow the selected backend role. Seller-only presets appear only when
                    the account role is set to Seller.
                  </div>
                )}
              </div>
            </section>

            <section className={sectionCardClass}>
              <h3 className="text-base font-semibold text-slate-900">Security</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                  <div className="flex items-start gap-2">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <p>
                      Leave the password fields blank to keep the current password. If you set a new
                      password here, the account must follow the same minimum rule as the create flow.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    New Password (optional)
                  </label>
                  <div className="relative">
                    <input
                      id="admin-edit-staff-password"
                      type={passwordVisible ? "text" : "password"}
                      value={form.password}
                      onChange={(event) => setField({ password: event.target.value })}
                      placeholder="Leave blank to keep current password"
                      className={`${fieldClass} pr-11`}
                      disabled={isSubmitting}
                    />
                    <PasswordVisibilityButton
                      visible={passwordVisible}
                      onToggle={() => setPasswordVisible((prev) => !prev)}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{PASSWORD_RULES_HELPER}</p>
                  <PasswordStrengthIndicator password={form.password} />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-edit-staff-password-confirm"
                      type={passwordConfirmVisible ? "text" : "password"}
                      value={form.passwordConfirm}
                      onChange={(event) => setField({ passwordConfirm: event.target.value })}
                      placeholder="Repeat the new password"
                      className={`${fieldClass} pr-11`}
                      disabled={isSubmitting}
                    />
                    <PasswordVisibilityButton
                      visible={passwordConfirmVisible}
                      onToggle={() => setPasswordConfirmVisible((prev) => !prev)}
                      labelShow="Show password confirmation"
                      labelHide="Hide password confirmation"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{PASSWORD_CONFIRM_HELPER}</p>
                </div>
              </div>
            </section>

            {submitError ? (
              <div
                id="admin-edit-staff-error"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
              >
                {submitError || GENERIC_ERROR}
              </div>
            ) : null}
          </div>

          <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => !isSubmitting && onClose()}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Updating..." : "Save Account Changes"}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}

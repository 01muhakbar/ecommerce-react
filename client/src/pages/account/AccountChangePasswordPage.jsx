import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { changeUserPassword } from "../../api/userPassword.ts";
import { useAccountAuth } from "../../auth/authDomainHooks.js";
import { storePendingAuthNotice } from "../../auth/authSessionNotice.js";
import { getStoreCustomization } from "../../api/public/storeCustomizationPublic.ts";
import { normalizeDashboardSettingCopy } from "../../utils/dashboardSettingCopy.js";
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import PasswordVisibilityButton from "../../components/auth/PasswordVisibilityButton.jsx";
import PasswordStrengthIndicator from "../../components/auth/PasswordStrengthIndicator.jsx";
import {
  CHANGE_PASSWORD_SUCCESS_MESSAGE,
  PASSWORD_CONFIRM_HELPER,
  PASSWORD_HIDDEN_HELPER,
} from "../../utils/authUi.js";

export default function AccountChangePasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAccountAuth();
  const currentPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const validationRef = useRef(null);
  const statusRef = useRef(null);
  const dashboardSettingQuery = useQuery({
    queryKey: ["store-customization", "dashboard-setting", "en"],
    queryFn: () => getStoreCustomization({ lang: "en", include: "dashboardSetting" }),
    staleTime: 60_000,
  });
  const dashboardSettingCopy = normalizeDashboardSettingCopy(
    dashboardSettingQuery.data?.customization?.dashboardSetting
  );
  const profileCopy = dashboardSettingCopy.updateProfile;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasMinLength = newPassword.length >= 8;
  const hasLetterAndNumber = /^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword);
  const isConfirmMatched = confirmPassword.length > 0 && newPassword === confirmPassword;

  const validationMessage = useMemo(() => {
    if (!newPassword && !confirmPassword) {
      return "";
    }
    if (newPassword && !hasMinLength) {
      return "New password must be at least 8 characters.";
    }
    if (newPassword && !hasLetterAndNumber) {
      return "New password must include at least one letter and one number.";
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return "New password and confirm password must match.";
    }
    return "";
  }, [confirmPassword, hasLetterAndNumber, hasMinLength, newPassword]);

  const canSubmit =
    Boolean(currentPassword && newPassword && confirmPassword) && !validationMessage && !isSubmitting;

  useEffect(() => {
    if (status?.message && statusRef.current) {
      statusRef.current.focus();
      return;
    }
    if (validationMessage && validationRef.current) {
      validationRef.current.focus();
    }
  }, [status, validationMessage]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      if (!currentPassword && currentPasswordRef.current) {
        currentPasswordRef.current.focus();
      } else if ((!newPassword || validationMessage) && newPasswordRef.current) {
        newPasswordRef.current.focus();
      } else if (confirmPasswordRef.current) {
        confirmPasswordRef.current.focus();
      }
      return;
    }

    setStatus(null);
    setIsSubmitting(true);
    try {
      const response = await changeUserPassword({
        currentPassword,
        newPassword,
      });
      setStatus({
        type: "success",
        message: response?.message || CHANGE_PASSWORD_SUCCESS_MESSAGE,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      storePendingAuthNotice(response?.message || CHANGE_PASSWORD_SUCCESS_MESSAGE);

      setTimeout(async () => {
        try {
          if (typeof logout === "function") {
            await logout();
          }
        } finally {
          navigate("/auth/login", {
            replace: true,
            state: {
              authNotice: CHANGE_PASSWORD_SUCCESS_MESSAGE,
            },
          });
        }
      }, 1200);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error?.response?.data?.message ||
          "We couldn't update your password. Check your current password and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {profileCopy.changePasswordLabel}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Update your password to keep your account secure. After a successful change, you will sign in again with your new password.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Password requirements:</p>
        <ul className="mt-1 list-disc pl-4">
          <li className={hasMinLength ? "text-emerald-700" : ""}>At least 8 characters</li>
          <li className={hasLetterAndNumber ? "text-emerald-700" : ""}>
            Include at least 1 letter and 1 number
          </li>
          <li className={isConfirmMatched ? "text-emerald-700" : ""}>Confirm password must match</li>
        </ul>
      </div>

      <div>
        <label htmlFor="account-current-password" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {profileCopy.currentPasswordLabel}
        </label>
        <div className="relative mt-2">
          <input
            id="account-current-password"
            ref={currentPasswordRef}
            type={showCurrentPassword ? "text" : "password"}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-12 text-sm"
            autoComplete="current-password"
            aria-invalid={Boolean(status?.type === "error" && !currentPassword)}
          />
          <PasswordVisibilityButton
            visible={showCurrentPassword}
            onToggle={() => setShowCurrentPassword((value) => !value)}
            labelShow="Show current password"
            labelHide="Hide current password"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">{PASSWORD_HIDDEN_HELPER}</p>
      </div>

      <div>
        <label htmlFor="account-new-password" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {profileCopy.newPasswordLabel}
        </label>
        <div className="relative mt-2">
          <input
            id="account-new-password"
            ref={newPasswordRef}
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-12 text-sm"
            autoComplete="new-password"
            aria-invalid={Boolean(validationMessage)}
            aria-describedby={validationMessage ? "account-change-password-validation" : undefined}
          />
          <PasswordVisibilityButton
            visible={showNewPassword}
            onToggle={() => setShowNewPassword((value) => !value)}
          />
        </div>
        <PasswordStrengthIndicator password={newPassword} />
      </div>

      <div>
        <label htmlFor="account-confirm-password" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Confirm New Password
        </label>
        <div className="relative mt-2">
          <input
            id="account-confirm-password"
            ref={confirmPasswordRef}
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-12 text-sm"
            autoComplete="new-password"
            aria-invalid={Boolean(validationMessage)}
            aria-describedby={validationMessage ? "account-change-password-validation" : "account-confirm-password-helper"}
          />
          <PasswordVisibilityButton
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
            labelShow="Show confirm password"
            labelHide="Hide confirm password"
          />
        </div>
        <p id="account-confirm-password-helper" className="mt-2 text-xs text-slate-500">
          {PASSWORD_CONFIRM_HELPER}
        </p>
      </div>

      {validationMessage && !status ? (
        <p
          id="account-change-password-validation"
          ref={validationRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="text-xs text-rose-600"
        >
          {validationMessage}
        </p>
      ) : null}

      {status ? (
        <AuthNotice
          id="account-change-password-status"
          tone={status.type === "success" ? "success" : "error"}
          live={status.type === "success" ? "polite" : "assertive"}
          focusRef={statusRef}
        >
          {status.message}
        </AuthNotice>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Updating password..." : profileCopy.changePasswordLabel}
      </button>
    </form>
  );
}

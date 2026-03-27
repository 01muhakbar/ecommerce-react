import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeUserPassword } from "../../api/userPassword.ts";
import { useAccountAuth } from "../../auth/authDomainHooks.js";

export default function AccountChangePasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAccountAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  const hasMinLength = newPassword.length >= 8;
  const hasLetterAndNumber = /^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword);
  const isConfirmMatched = confirmPassword.length > 0 && newPassword === confirmPassword;

  const validationMessage = useMemo(() => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return "Please complete all fields.";
    }
    if (!hasMinLength) {
      return "New password must be at least 8 characters.";
    }
    if (!hasLetterAndNumber) {
      return "New password must include at least one letter and one number.";
    }
    if (newPassword !== confirmPassword) {
      return "New password and confirm password must match.";
    }
    return "";
  }, [confirmPassword, currentPassword, hasLetterAndNumber, hasMinLength, newPassword]);

  const canSubmit = !validationMessage && !isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus(null);
    setIsSubmitting(true);
    try {
      const response = await changeUserPassword({
        currentPassword,
        newPassword,
      });
      setStatus({
        type: "success",
        message: response?.message || "Password updated successfully.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(async () => {
        try {
          if (typeof logout === "function") {
            await logout();
          }
        } finally {
          navigate("/auth/login", { replace: true });
        }
      }, 1200);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error?.response?.data?.message || "Failed to update password. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Change Password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update your password to keep your account secure.
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
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Current Password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          autoComplete="current-password"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Confirm New Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          autoComplete="new-password"
        />
      </div>

      {validationMessage && !status ? <p className="text-xs text-slate-500">{validationMessage}</p> : null}

      {status ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : "Save Password"}
      </button>
    </form>
  );
}

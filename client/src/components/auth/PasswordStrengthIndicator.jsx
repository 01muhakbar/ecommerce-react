import { PASSWORD_RULES_HELPER } from "../../utils/authUi.js";

const LEVEL_STYLES = {
  idle: {
    label: "Not set",
    textClass: "text-slate-500",
    barClass: "bg-slate-200",
    activeBars: 0,
    helper: PASSWORD_RULES_HELPER,
  },
  weak: {
    label: "Weak",
    textClass: "text-rose-600",
    barClass: "bg-rose-500",
    activeBars: 1,
    helper: "Too weak right now. Add more length and mix letters with numbers.",
  },
  fair: {
    label: "Fair",
    textClass: "text-amber-600",
    barClass: "bg-amber-500",
    activeBars: 2,
    helper: "Good start. Add uppercase letters, symbols, or more length.",
  },
  good: {
    label: "Good",
    textClass: "text-sky-600",
    barClass: "bg-sky-500",
    activeBars: 3,
    helper: "Strong enough for most cases. More length or symbols will improve it.",
  },
  strong: {
    label: "Strong",
    textClass: "text-emerald-600",
    barClass: "bg-emerald-500",
    activeBars: 4,
    helper: "Strong password.",
  },
};

function evaluatePasswordStrength(password) {
  const value = String(password || "");
  if (!value) return LEVEL_STYLES.idle;

  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || value.length >= 12) score += 1;

  if (score <= 1) return LEVEL_STYLES.weak;
  if (score === 2) return LEVEL_STYLES.fair;
  if (score === 3) return LEVEL_STYLES.good;
  return LEVEL_STYLES.strong;
}

export default function PasswordStrengthIndicator({ password }) {
  const strength = evaluatePasswordStrength(password);

  return (
    <div className="mt-2 space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">Password strength</span>
        <span className={`font-semibold ${strength.textClass}`}>{strength.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full ${
              index < strength.activeBars ? strength.barClass : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${strength.textClass}`}>{strength.helper}</p>
    </div>
  );
}

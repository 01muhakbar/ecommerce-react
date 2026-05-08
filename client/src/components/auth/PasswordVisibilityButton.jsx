import { Eye, EyeOff } from "lucide-react";

export default function PasswordVisibilityButton({
  visible,
  onToggle,
  labelShow = "Show password",
  labelHide = "Hide password",
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute inset-y-0 right-3 inline-flex items-center justify-center rounded-md text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1"
      aria-label={visible ? labelHide : labelShow}
      aria-pressed={visible}
      title={visible ? labelHide : labelShow}
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

import { getAuthNoticeClasses } from "../../utils/authUi.js";

export default function AuthNotice({
  id,
  tone = "neutral",
  children,
  live = "polite",
  focusRef = null,
  className = "",
}) {
  if (!children) return null;

  return (
    <div
      id={id}
      ref={focusRef}
      tabIndex={-1}
      role={tone === "error" ? "alert" : "status"}
      aria-live={live}
      className={`rounded-lg border px-3 py-2 text-sm ${getAuthNoticeClasses(tone)} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

import useStoreBranding from "../../hooks/useStoreBranding.js";
import { getWorkspaceLogoUrl } from "../../lib/branding.js";
import "./WorkspaceSidebarBrand.css";

export default function WorkspaceSidebarBrand({
  brandName = "TP PRENEURS",
  workspaceLabel,
  workspaceKey = "admin",
  collapsed = false,
  className = "",
}) {
  const { branding } = useStoreBranding();
  const logoUrl =
    workspaceKey === "seller" ? branding.sellerLogoUrl : branding.adminLogoUrl;
  const logoSrc = getWorkspaceLogoUrl(workspaceKey, logoUrl);
  const resolvedBrandName = String(branding.workspaceBrandName || brandName).trim() || brandName;

  return (
    <div
      className={`workspace-sidebar-brand ${collapsed ? "is-collapsed" : ""} ${className}`.trim()}
    >
      <span className="workspace-sidebar-brand__mark">
        <img
          src={logoSrc}
          alt={`${resolvedBrandName} ${workspaceLabel} logo`}
          className="workspace-sidebar-brand__image"
        />
      </span>
      <div className="workspace-sidebar-brand__copy">
        <span className="workspace-sidebar-brand__title">{resolvedBrandName}</span>
        <span className="workspace-sidebar-brand__subtitle">{workspaceLabel}</span>
      </div>
    </div>
  );
}

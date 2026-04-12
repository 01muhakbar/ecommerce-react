import { resolveAssetUrl } from "./assetUrl.js";

const svgToDataUri = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const createSquareFallbackLogo = (label) =>
  svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill="url(#brand-grad)" />
      <rect x="18" y="18" width="84" height="84" rx="22" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.18)" />
      <text x="60" y="71" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="3">
        TP
      </text>
    </svg>
  `);

export const DEFAULT_BRANDING_LOGOS = {
  admin: createSquareFallbackLogo("Admin Workspace logo"),
  seller: createSquareFallbackLogo("Seller Workspace logo"),
};

export const getWorkspaceLogoUrl = (workspaceKey, logoUrl) =>
  resolveAssetUrl(logoUrl) || DEFAULT_BRANDING_LOGOS[workspaceKey] || DEFAULT_BRANDING_LOGOS.admin;

export const hasCustomBrandingLogo = (logoUrl) => Boolean(String(logoUrl || "").trim());

export const getWorkspaceBrandingKeyFromPathname = (pathname = "") =>
  String(pathname || "").startsWith("/seller") ? "seller" : "admin";

export const getWorkspaceFaviconUrl = (pathname = "", branding = {}, fallbackUrl = "") => {
  const workspaceKey = getWorkspaceBrandingKeyFromPathname(pathname);
  const logoUrl =
    workspaceKey === "seller" ? branding?.sellerLogoUrl : branding?.adminLogoUrl;

  return resolveAssetUrl(logoUrl) || getWorkspaceLogoUrl(workspaceKey, logoUrl) || fallbackUrl;
};

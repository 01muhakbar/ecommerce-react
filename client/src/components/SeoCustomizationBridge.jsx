import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { getStoreCustomization } from "../api/public/storeCustomizationPublic.ts";
import useStoreBranding from "../hooks/useStoreBranding.js";
import { getWorkspaceFaviconUrl } from "../lib/branding.js";
import { normalizeSeoSettings, resolveSeoAbsoluteUrl } from "../utils/seoSettings.js";

const ensureMetaTag = (selector, attrs = {}) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }
  return element;
};

const ensureLinkTag = (selector, attrs = {}) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }
  return element;
};

const buildDocumentTitle = (pathname, metaTitle, fallbackTitle, branding = {}) => {
  const workspaceBrandName =
    String(branding?.workspaceBrandName || "").trim() || "TP PRENEURS";
  const normalizedMetaTitle = String(metaTitle || "").trim();
  const fallback = String(fallbackTitle || workspaceBrandName).trim() || workspaceBrandName;

  if (pathname.startsWith("/admin")) {
    return `${workspaceBrandName} | Admin Workspace`;
  }

  if (pathname.startsWith("/seller")) {
    return `${workspaceBrandName} | Seller Workspace`;
  }

  return normalizedMetaTitle || workspaceBrandName || fallback;
};

export default function SeoCustomizationBridge() {
  const location = useLocation();
  const { branding } = useStoreBranding();
  const seoSettingsQuery = useQuery({
    queryKey: ["store-customization", "seo-settings", "en"],
    queryFn: () => getStoreCustomization({ lang: "en", include: "seoSettings" }),
    staleTime: 60_000,
  });
  const seoSettings = normalizeSeoSettings(
    seoSettingsQuery.data?.customization?.seoSettings
  );
  const currentUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, [location.key, location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const existingTitle = document.title;
    const faviconLink = ensureLinkTag("link[rel='icon']", {
      rel: "icon",
      type: "image/x-icon",
    });
    const originalFaviconHref = faviconLink.getAttribute("href") || "/vite.svg";
    const workspaceFaviconHref = getWorkspaceFaviconUrl(
      location.pathname,
      branding,
      originalFaviconHref
    );

    const descriptionMeta = ensureMetaTag("meta[name='description']", {
      name: "description",
    });
    const keywordsMeta = ensureMetaTag("meta[name='keywords']", { name: "keywords" });
    const ogTitleMeta = ensureMetaTag("meta[property='og:title']", {
      property: "og:title",
    });
    const ogDescriptionMeta = ensureMetaTag("meta[property='og:description']", {
      property: "og:description",
    });
    const ogImageMeta = ensureMetaTag("meta[property='og:image']", {
      property: "og:image",
    });
    const ogUrlMeta = ensureMetaTag("meta[property='og:url']", {
      property: "og:url",
    });
    const canonicalLink = ensureLinkTag("link[rel='canonical']", {
      rel: "canonical",
    });

    const nextTitle = buildDocumentTitle(
      location.pathname,
      seoSettings.metaTitle,
      existingTitle,
      branding
    );
    const nextDescription = seoSettings.metaDescription;
    const nextKeywords = seoSettings.metaKeywords;
    const nextImage = seoSettings.metaImageDataUrl;
    const nextUrl = resolveSeoAbsoluteUrl(seoSettings.metaUrl, currentUrl);

    document.title = nextTitle;
    descriptionMeta.setAttribute("content", nextDescription);
    keywordsMeta.setAttribute("content", nextKeywords);
    ogTitleMeta.setAttribute("content", nextTitle);
    ogDescriptionMeta.setAttribute("content", nextDescription);
    ogImageMeta.setAttribute("content", nextImage);
    ogUrlMeta.setAttribute("content", nextUrl);
    canonicalLink.setAttribute("href", nextUrl);
    faviconLink.setAttribute(
      "href",
      workspaceFaviconHref || seoSettings.faviconDataUrl || originalFaviconHref
    );

    return () => {
      document.title = existingTitle;
      faviconLink.setAttribute("href", originalFaviconHref);
    };
  }, [
    currentUrl,
    branding,
    location.pathname,
    seoSettings.faviconDataUrl,
    seoSettings.metaDescription,
    seoSettings.metaImageDataUrl,
    seoSettings.metaKeywords,
    seoSettings.metaTitle,
    seoSettings.metaUrl,
  ]);

  return null;
}

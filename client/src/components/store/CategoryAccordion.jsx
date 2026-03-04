import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocation, useSearchParams } from "react-router-dom";

const iconFromName = (name = "") => {
  const value = String(name).toLowerCase();
  if (value.includes("fish") || value.includes("meat")) return "🐟";
  if (value.includes("fruit") || value.includes("vegetable") || value.includes("veg")) {
    return "🥬";
  }
  if (value.includes("cook")) return "🍳";
  if (value.includes("biscuit") || value.includes("cake") || value.includes("bread")) {
    return "🍪";
  }
  if (value.includes("house") || value.includes("tool")) return "🧰";
  if (value.includes("pet")) return "🐾";
  if (value.includes("beauty") || value.includes("health")) return "💄";
  if (value.includes("jam") || value.includes("jelly")) return "🍓";
  return "📦";
};

const resolveIconNode = (node) => {
  const imageValue = String(node?.image || "").trim();
  const hasImagePath =
    imageValue.startsWith("/") ||
    imageValue.startsWith("./") ||
    imageValue.startsWith("../") ||
    imageValue.startsWith("http://") ||
    imageValue.startsWith("https://") ||
    imageValue.startsWith("data:image/") ||
    /\/.+\./.test(imageValue) ||
    /\.(png|jpe?g|webp|svg|gif|avif)(\?|$)/i.test(imageValue);
  if (hasImagePath) {
    return (
      <img
        src={imageValue}
        alt={node?.name || "category icon"}
        className="h-6 w-6 rounded object-cover"
      />
    );
  }
  const iconValue = String(node?.icon || "").trim();
  if (!iconValue) return iconFromName(node?.name);
  return iconValue;
};

const normalizeKey = (value) => String(value ?? "").trim().toLowerCase();

const resolveCategoryFromPathname = (pathname = "") => {
  const normalized = String(pathname || "");
  if (!normalized.startsWith("/category/")) return "";
  const raw = normalized.split("/")[2] ?? "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
};

const nodeMatchesSelected = (node, selectedKey) => {
  if (!selectedKey) return false;
  const candidates = [node?.code, node?.slug, node?.id]
    .map((value) => normalizeKey(value))
    .filter(Boolean);
  return candidates.includes(selectedKey);
};

const findActivePath = (items, selectedKey, path = []) => {
  if (!Array.isArray(items) || items.length === 0 || !selectedKey) return [];
  for (const node of items) {
    const nodeId = String(node?.id ?? node?.slug ?? "");
    if (!nodeId) continue;
    const nextPath = [...path, nodeId];
    if (nodeMatchesSelected(node, selectedKey)) {
      return nextPath;
    }
    const nestedPath = findActivePath(node?.children || [], selectedKey, nextPath);
    if (nestedPath.length > 0) {
      return nestedPath;
    }
  }
  return [];
};

const toPanelId = (id) =>
  `category-branch-${String(id || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")}`;

export default function CategoryAccordion({
  nodes,
  onSelect,
  defaultExpandedIds = [],
  className = "",
}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedFromQuery = String(searchParams.get("category") || "").trim();
  const selectedFromPath = resolveCategoryFromPathname(location.pathname);
  const selectedCategory = selectedFromQuery || selectedFromPath;
  const selectedCategoryKey = normalizeKey(selectedCategory);

  const activePathIds = useMemo(
    () => findActivePath(nodes || [], selectedCategoryKey),
    [nodes, selectedCategoryKey]
  );
  const activePathSet = useMemo(() => new Set(activePathIds), [activePathIds]);

  const baseExpandedIds = useMemo(() => {
    const source = new Set((defaultExpandedIds || []).map((id) => String(id)));
    activePathIds.forEach((id) => source.add(String(id)));
    return source;
  }, [defaultExpandedIds, activePathIds]);

  const [expandedIds, setExpandedIds] = useState(baseExpandedIds);

  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      baseExpandedIds.forEach((id) => next.add(id));
      return next;
    });
  }, [baseExpandedIds]);

  const toggle = (id) => {
    const key = String(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderNodes = (items, level = 0) =>
    items.map((node, index) => {
      const nodeId = String(node?.id ?? `${node?.slug ?? "node"}-${index}`);
      const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
      const isExpanded = expandedIds.has(nodeId);
      const nestedPadding = level > 0 ? 12 + level * 10 : 0;
      const isSelected = nodeMatchesSelected(node, selectedCategoryKey);
      const isBranchActive = activePathSet.has(nodeId);
      const panelId = toPanelId(nodeId);
      const rowLabel = node?.name || node?.code || node?.slug || "-";

      return (
        <div
          key={nodeId}
          className={`${level === 0 ? "border-b border-slate-100 last:border-b-0" : "border-l border-slate-100"}`}
        >
          <div style={nestedPadding > 0 ? { paddingLeft: `${nestedPadding}px` } : undefined}>
            <div
              className={`group flex min-h-12 items-center gap-1 rounded-xl px-2 py-1.5 transition ${
                isBranchActive
                  ? "bg-emerald-50/70"
                  : "hover:bg-slate-50"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (hasChildren) {
                    toggle(nodeId);
                    return;
                  }
                  onSelect?.(node);
                }}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1 text-left"
              >
                {level === 0 ? (
                  <span
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${
                      isBranchActive ? "bg-emerald-100/80" : "bg-slate-100"
                    }`}
                  >
                    {resolveIconNode(node)}
                  </span>
                ) : (
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
                    <span className="h-px w-3 rounded bg-slate-300" />
                  </span>
                )}

                <span
                  className={`min-w-0 flex-1 truncate ${
                    level === 0 ? "text-sm" : "text-[13px]"
                  } ${
                    isSelected
                      ? "font-semibold text-emerald-700"
                      : isBranchActive
                        ? "font-medium text-slate-800"
                        : "font-medium text-slate-700"
                  }`}
                >
                  {rowLabel}
                </span>
                {isSelected ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                ) : null}
              </button>

              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(nodeId)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${rowLabel}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-600"
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-sm text-slate-300">
                  ›
                </span>
              )}
            </div>
          </div>

          {hasChildren && isExpanded ? (
            <div id={panelId} className="pb-1">
              {renderNodes(node.children, level + 1)}
            </div>
          ) : null}
        </div>
      );
    });

  return <div className={`w-full overflow-x-hidden ${className}`}>{renderNodes(nodes || [])}</div>;
}

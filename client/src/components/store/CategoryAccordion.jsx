import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";

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

export default function CategoryAccordion({
  nodes,
  onSelect,
  defaultExpandedIds = [],
  className = "",
}) {
  const initialExpanded = useMemo(
    () => new Set((defaultExpandedIds || []).map((id) => String(id))),
    [defaultExpandedIds]
  );
  const [searchParams] = useSearchParams();
  const [expandedIds, setExpandedIds] = useState(initialExpanded);
  const selectedCategory = String(searchParams.get("category") || "").trim();

  useEffect(() => {
    setExpandedIds(new Set((defaultExpandedIds || []).map((id) => String(id))));
  }, [defaultExpandedIds]);

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
      const isLeaf = !hasChildren;
      const nodeCode = String(node?.code || "").trim();
      const nodeSlug = String(node?.slug || "").trim();
      const nodeKey = String(node?.id || "").trim();
      const isSelectedLeaf =
        isLeaf &&
        selectedCategory.length > 0 &&
        (selectedCategory === nodeCode ||
          selectedCategory === nodeSlug ||
          selectedCategory === nodeKey);

      return (
        <div
          key={nodeId}
          className={`${level === 0 ? "border-b border-slate-100 last:border-b-0" : ""}`}
        >
          <div style={nestedPadding > 0 ? { paddingLeft: `${nestedPadding}px` } : undefined}>
            <button
              type="button"
              onClick={() => {
                if (hasChildren) {
                  toggle(nodeId);
                  return;
                }
                onSelect?.(node);
              }}
              className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 ${
                isSelectedLeaf ? "border-l-2 border-emerald-500 bg-slate-50 font-semibold" : ""
              }`}
            >
              {level === 0 ? (
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base">
                  {resolveIconNode(node)}
                </span>
              ) : (
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
                  <span className="h-px w-3 rounded bg-slate-300" />
                </span>
              )}

              <span
                className={`min-w-0 flex-1 truncate ${
                  level === 0 ? "text-sm font-medium text-slate-800" : "text-[13px] text-slate-700"
                }`}
              >
                {node?.name || node?.code || node?.slug || "-"}
              </span>

              {hasChildren ? (
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              ) : (
                <span className="shrink-0 text-sm text-slate-300">›</span>
              )}
            </button>
          </div>

          {hasChildren && isExpanded ? (
            <div className="pb-1">{renderNodes(node.children, level + 1)}</div>
          ) : null}
        </div>
      );
    });

  return <div className={`w-full overflow-x-hidden ${className}`}>{renderNodes(nodes || [])}</div>;
}

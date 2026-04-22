import { Layers3 } from "lucide-react";
import {
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
} from "./SellerWorkspaceFoundation.jsx";

const tableCellClass = "px-3 py-2.5 text-sm text-slate-700 align-top";
const tableHeadClass =
  "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

export default function SellerProductVariationSummary({
  summary,
  formatCurrency,
  emptyTitle = "No variants stored",
  emptyDescription = "This product does not currently expose variant data.",
  readOnlyHint = "Variants are visible here for reference only.",
}) {
  const normalizedSummary = summary || {
    hasStructuredData: false,
    attributeCount: 0,
    totalOptionCount: 0,
    variantCount: 0,
    attributes: [],
    variants: [],
  };
  const hasPrice = normalizedSummary.variants.some((entry) => entry.price != null);
  const hasSalePrice = normalizedSummary.variants.some((entry) => entry.salePrice != null);
  const hasQuantity = normalizedSummary.variants.some((entry) => entry.quantity != null);
  const hasSku = normalizedSummary.variants.some((entry) => entry.sku);

  if (!normalizedSummary.hasStructuredData) {
    return (
      <SellerWorkspaceEmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<Layers3 className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Attributes
          </p>
          <p className="mt-1.5 text-sm font-medium text-slate-900">
            {normalizedSummary.attributeCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Options
          </p>
          <p className="mt-1.5 text-sm font-medium text-slate-900">
            {normalizedSummary.totalOptionCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Variants
          </p>
          <p className="mt-1.5 text-sm font-medium text-slate-900">
            {normalizedSummary.variantCount}
          </p>
        </div>
      </div>

      {normalizedSummary.attributes.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Attribute Values
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {normalizedSummary.attributes.map((attribute) => (
              <div
                key={attribute.key}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">{attribute.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {attribute.values.length > 0 ? (
                    attribute.values.map((value) => (
                      <SellerWorkspaceBadge
                        key={`${attribute.key}-${value}`}
                        label={value}
                        tone="sky"
                      />
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No option values stored.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-3.5 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Variant Rows
          </p>
          <p className="mt-1 text-sm text-slate-500">{readOnlyHint}</p>
        </div>

        {normalizedSummary.variants.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className={tableHeadClass}>Combination</th>
                  {hasSku ? <th className={tableHeadClass}>SKU</th> : null}
                  {hasPrice ? <th className={tableHeadClass}>Price</th> : null}
                  {hasSalePrice ? <th className={tableHeadClass}>Sale Price</th> : null}
                  {hasQuantity ? <th className={tableHeadClass}>Stock</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {normalizedSummary.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className={tableCellClass}>
                      <div className="space-y-1.5">
                        <p className="font-medium text-slate-900">{variant.label}</p>
                        {variant.selections.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {variant.selections.map((selection) => (
                              <SellerWorkspaceBadge
                                key={`${variant.id}-${selection.key}-${selection.value}`}
                                label={`${selection.name}: ${selection.value}`}
                                tone="stone"
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    {hasSku ? <td className={tableCellClass}>{variant.sku || "-"}</td> : null}
                    {hasPrice ? (
                      <td className={tableCellClass}>
                        {variant.price != null ? formatCurrency(variant.price) : "-"}
                      </td>
                    ) : null}
                    {hasSalePrice ? (
                      <td className={tableCellClass}>
                        {variant.salePrice != null ? formatCurrency(variant.salePrice) : "-"}
                      </td>
                    ) : null}
                    {hasQuantity ? (
                      <td className={tableCellClass}>
                        {variant.quantity != null ? String(variant.quantity) : "-"}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-3.5 py-4 text-sm text-slate-500">
            No seller-safe variant rows are available in the current read model.
          </div>
        )}
      </div>
    </div>
  );
}

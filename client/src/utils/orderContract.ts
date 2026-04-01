const asObject = (value: unknown): Record<string, any> | null =>
  value && typeof value === "object" ? (value as Record<string, any>) : null;

const normalizeCode = (value: unknown) =>
  String(value || "")
    .trim()
    .toUpperCase();

// Defensive selectors only. They never synthesize lifecycle state when the backend contract is absent.
// New consumers should read backend contract fields first instead of rebuilding status or CTA logic locally.
export const getOrderContract = (value: unknown) => asObject(value);

export const getOrderContractSummary = (value: unknown) => {
  const contract = getOrderContract(value);
  return asObject(contract?.statusSummary);
};

export const getOrderContractMeta = (value: unknown, key: string) => {
  const contract = getOrderContract(value);
  return asObject(contract?.[key]);
};

export const getOrderContractAction = (value: unknown, code: string) => {
  const contract = getOrderContract(value);
  if (!Array.isArray(contract?.availableActions)) return null;
  const targetCode = normalizeCode(code);
  return (
    contract.availableActions.find(
      (action) => normalizeCode(asObject(action)?.code) === targetCode
    ) || null
  );
};

export const isOrderContractFinal = (value: unknown) =>
  Boolean(getOrderContractSummary(value)?.isFinal);

export const STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES = [
  "id",
  "storeId",
  "providerCode",
  "paymentType",
  "version",
  "snapshotStatus",
  "accountName",
  "merchantName",
  "merchantId",
  "qrisImageUrl",
  "qrisPayload",
  "instructionText",
  "isActive",
  "verificationStatus",
  "sourceRequestId",
  "verifiedByAdminId",
  "verifiedAt",
  "activatedByAdminId",
  "activatedAt",
  "supersededByProfileId",
  "supersededAt",
  "createdAt",
  "updatedAt",
] as const;

export const STORE_PAYMENT_PROFILE_CHECKOUT_ATTRIBUTES = [
  "id",
  "storeId",
  "providerCode",
  "paymentType",
  "isActive",
  "verificationStatus",
  "instructionText",
  "qrisImageUrl",
  "qrisPayload",
  "version",
  "snapshotStatus",
] as const;

export const resolvePreferredStorePaymentProfile = (store: any) =>
  store?.activePaymentProfile ??
  store?.get?.("activePaymentProfile") ??
  store?.paymentProfile ??
  store?.get?.("paymentProfile") ??
  null;

export const resolvePreferredStorePaymentProfileByStoreRow = async (
  StorePaymentProfileModel: any,
  store: any,
  options: { includeVerifiedByAdmin?: boolean } = {}
) => {
  const activeStorePaymentProfileId =
    Number(
      store?.activeStorePaymentProfileId ??
        store?.get?.("activeStorePaymentProfileId") ??
        0
    ) || null;

  const include = options.includeVerifiedByAdmin
    ? [
        {
          association: "verifiedByAdmin",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ]
    : [];

  if (activeStorePaymentProfileId) {
    const activeProfile = await StorePaymentProfileModel.findByPk(activeStorePaymentProfileId, {
      attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
      include,
    });
    if (activeProfile) return activeProfile;
  }

  const storeId = Number(store?.id ?? store?.get?.("id") ?? store?.storeId ?? 0);
  if (!storeId) return null;

  return StorePaymentProfileModel.findOne({
    where: { storeId },
    attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
    include,
    order: [
      ["isActive", "DESC"],
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });
};

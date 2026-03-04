import { Op } from "sequelize";
import { sequelize, UserAddress } from "../models/index.js";

export type AddressMarkAs = "HOME" | "OFFICE";

export type UserAddressPayload = {
  fullName: string;
  phoneNumber: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  streetName: string;
  building?: string | null;
  houseNumber: string;
  otherDetails?: string | null;
  markAs: AddressMarkAs;
  isPrimary: boolean;
  isStore: boolean;
  isReturn: boolean;
};

const toAddressData = (item: any) => ({
  id: Number(item?.id || 0),
  userId: Number(item?.userId || 0),
  fullName: String(item?.fullName || ""),
  phoneNumber: String(item?.phoneNumber || ""),
  province: String(item?.province || ""),
  city: String(item?.city || ""),
  district: String(item?.district || ""),
  postalCode: String(item?.postalCode || ""),
  streetName: String(item?.streetName || ""),
  building: item?.building ?? null,
  houseNumber: String(item?.houseNumber || ""),
  otherDetails: item?.otherDetails ?? null,
  markAs: String(item?.markAs || "HOME"),
  isPrimary: Boolean(item?.isPrimary),
  isStore: Boolean(item?.isStore),
  isReturn: Boolean(item?.isReturn),
  createdAt: item?.createdAt ?? null,
  updatedAt: item?.updatedAt ?? null,
});

let ensured = false;

const ensureAddressStorage = async () => {
  if (ensured) return;
  await UserAddress.sync();
  ensured = true;
};

const normalizePayload = (payload: UserAddressPayload): UserAddressPayload => ({
  fullName: String(payload.fullName || "").trim(),
  phoneNumber: String(payload.phoneNumber || "").trim(),
  province: String(payload.province || "").trim(),
  city: String(payload.city || "").trim(),
  district: String(payload.district || "").trim(),
  postalCode: String(payload.postalCode || "").trim(),
  streetName: String(payload.streetName || "").trim(),
  building: String(payload.building || "").trim() || null,
  houseNumber: String(payload.houseNumber || "").trim(),
  otherDetails: String(payload.otherDetails || "").trim() || null,
  markAs: payload.markAs === "OFFICE" ? "OFFICE" : "HOME",
  isPrimary: Boolean(payload.isPrimary),
  isStore: Boolean(payload.isStore),
  isReturn: Boolean(payload.isReturn),
});

const applyUniqueFlags = async (
  userId: number,
  flags: Pick<UserAddressPayload, "isPrimary" | "isStore" | "isReturn">,
  excludeId?: number,
  transaction?: any
) => {
  const whereClause = excludeId
    ? { userId, id: { [Op.ne]: excludeId } }
    : { userId };

  if (flags.isPrimary) {
    await UserAddress.update(
      { isPrimary: false },
      {
        where: whereClause,
        transaction,
      }
    );
  }
  if (flags.isStore) {
    await UserAddress.update(
      { isStore: false },
      {
        where: whereClause,
        transaction,
      }
    );
  }
  if (flags.isReturn) {
    await UserAddress.update(
      { isReturn: false },
      {
        where: whereClause,
        transaction,
      }
    );
  }
};

export const listAddressesByUser = async (userId: number) => {
  await ensureAddressStorage();
  const items = await UserAddress.findAll({
    where: { userId },
    order: [
      ["isPrimary", "DESC"],
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });
  return items.map(toAddressData);
};

export const getDefaultAddressByUser = async (userId: number) => {
  await ensureAddressStorage();
  const item = await UserAddress.findOne({
    where: { userId, isPrimary: true },
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });
  return item ? toAddressData(item) : null;
};

export const createAddressForUser = async (userId: number, payload: UserAddressPayload) => {
  await ensureAddressStorage();
  const data = normalizePayload(payload);

  return sequelize.transaction(async (transaction) => {
    await applyUniqueFlags(
      userId,
      {
        isPrimary: data.isPrimary,
        isStore: data.isStore,
        isReturn: data.isReturn,
      },
      undefined,
      transaction
    );

    const created = await UserAddress.create(
      {
        userId,
        ...data,
      },
      { transaction }
    );

    return toAddressData(created);
  });
};

export const updateAddressForUser = async (
  userId: number,
  addressId: number,
  payload: UserAddressPayload
) => {
  await ensureAddressStorage();
  const data = normalizePayload(payload);

  return sequelize.transaction(async (transaction) => {
    const existing = await UserAddress.findOne({
      where: { id: addressId, userId },
      transaction,
    });
    if (!existing) return null;

    await applyUniqueFlags(
      userId,
      {
        isPrimary: data.isPrimary,
        isStore: data.isStore,
        isReturn: data.isReturn,
      },
      addressId,
      transaction
    );

    await existing.update(data, { transaction });
    return toAddressData(existing);
  });
};

export const deleteAddressForUser = async (userId: number, addressId: number) => {
  await ensureAddressStorage();
  const deleted = await UserAddress.destroy({
    where: { id: addressId, userId },
  });
  return deleted > 0;
};

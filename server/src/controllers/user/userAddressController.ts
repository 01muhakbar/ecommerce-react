import type { Request, Response } from "express";
import {
  createAddressForUser,
  deleteAddressForUser,
  getDefaultAddressByUser,
  listAddressesByUser,
  updateAddressForUser,
  type UserAddressPayload,
} from "../../services/userAddress.service.js";

const POSTAL_CODE_REGEX = /^\d{5}$/;
const ALLOWED_MARK_AS = new Set(["HOME", "OFFICE"]);

const toText = (value: unknown) => String(value ?? "").trim();

const getAuthUserId = (req: Request) => {
  const userId = Number((req as any)?.user?.id);
  return Number.isFinite(userId) && userId > 0 ? userId : 0;
};

const parseAddressPayload = (
  body: Record<string, unknown> | undefined
): { ok: true; value: UserAddressPayload } | { ok: false; message: string } => {
  const source = body ?? {};
  const fullName = toText(source.fullName);
  const phoneNumber = toText(source.phoneNumber);
  const province = toText(source.province);
  const city = toText(source.city);
  const district = toText(source.district);
  const postalCode = toText(source.postalCode);
  const streetName = toText(source.streetName);
  const houseNumber = toText(source.houseNumber);
  const building = toText(source.building);
  const otherDetails = toText(source.otherDetails);
  const markAsRaw = toText(source.markAs).toUpperCase();
  const markAs = (markAsRaw || "HOME") as "HOME" | "OFFICE";
  const isPrimary = Boolean(source.isPrimary);
  const isStore = Boolean(source.isStore);
  const isReturn = Boolean(source.isReturn);

  if (!fullName) return { ok: false, message: "fullName is required" };
  if (!phoneNumber) return { ok: false, message: "phoneNumber is required" };
  if (!province) return { ok: false, message: "province is required" };
  if (!city) return { ok: false, message: "city is required" };
  if (!district) return { ok: false, message: "district is required" };
  if (!postalCode) return { ok: false, message: "postalCode is required" };
  if (!POSTAL_CODE_REGEX.test(postalCode)) {
    return { ok: false, message: "postalCode must be a 5 digit number" };
  }
  if (!streetName) return { ok: false, message: "streetName is required" };
  if (!houseNumber) return { ok: false, message: "houseNumber is required" };
  if (!ALLOWED_MARK_AS.has(markAs)) {
    return { ok: false, message: "markAs must be HOME or OFFICE" };
  }

  return {
    ok: true,
    value: {
      fullName,
      phoneNumber,
      province,
      city,
      district,
      postalCode,
      streetName,
      building: building || null,
      houseNumber,
      otherDetails: otherDetails || null,
      markAs,
      isPrimary,
      isStore,
      isReturn,
    },
  };
};

export const getUserAddresses = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const items = await listAddressesByUser(userId);
    return res.json({ success: true, data: { items } });
  } catch (error) {
    console.error("[user.addresses][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load addresses" });
  }
};

export const getUserDefaultAddress = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const address = await getDefaultAddressByUser(userId);
    return res.json({ success: true, data: address });
  } catch (error) {
    console.error("[user.addresses.default][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load default address" });
  }
};

export const createUserAddress = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = parseAddressPayload(req.body as Record<string, unknown>);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, message: parsed.message });
    }

    const created = await createAddressForUser(userId, parsed.value);
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("[user.addresses][POST] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to create address" });
  }
};

export const updateUserAddress = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const addressId = Number(req.params.id);
    if (!Number.isFinite(addressId) || addressId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid address id" });
    }

    const parsed = parseAddressPayload(req.body as Record<string, unknown>);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, message: parsed.message });
    }

    const updated = await updateAddressForUser(userId, addressId, parsed.value);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[user.addresses][PUT] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update address" });
  }
};

export const deleteUserAddress = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const addressId = Number(req.params.id);
    if (!Number.isFinite(addressId) || addressId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid address id" });
    }

    const deleted = await deleteAddressForUser(userId, addressId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("[user.addresses][DELETE] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to delete address" });
  }
};

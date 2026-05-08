import type {
  UserAddress,
  UserAddressPayload,
  UserAddressMarkAs,
} from "../api/userAddresses.ts";

export const POSTAL_CODE_REGEX = /^\d{5}$/;
export const EMAIL_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserAddressForm = Omit<UserAddressPayload, "fullName"> & {
  firstName: string;
  lastName: string;
  emailAddress: string;
};

type UserAddressLike = Partial<
  UserAddress & {
    firstName?: string | null;
    lastName?: string | null;
    emailAddress?: string | null;
  }
>;

const normalizeText = (value: unknown) => String(value ?? "").trim();

export const buildFullName = (firstName: unknown, lastName: unknown) =>
  [normalizeText(firstName), normalizeText(lastName)].filter(Boolean).join(" ").trim();

export const createEmptyUserAddressForm = (
  fallbackEmailAddress = ""
): UserAddressForm => ({
  firstName: "",
  lastName: "",
  emailAddress: normalizeText(fallbackEmailAddress),
  phoneNumber: "",
  province: "",
  city: "",
  district: "",
  postalCode: "",
  streetName: "",
  building: "",
  houseNumber: "",
  otherDetails: "",
  markAs: "HOME",
  isPrimary: false,
  isStore: false,
  isReturn: false,
});

export const EMPTY_USER_ADDRESS_FORM = createEmptyUserAddressForm();

export const splitFullName = (fullName: string) => {
  const normalized = normalizeText(fullName).replace(/\s+/g, " ");
  if (!normalized) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName: firstName || "",
    lastName: rest.join(" "),
  };
};

export const formatContactName = (
  item: Pick<UserAddressLike, "fullName" | "firstName" | "lastName">
) => {
  const explicitName = buildFullName(item.firstName, item.lastName);
  if (explicitName) return explicitName;
  const legacyName = normalizeText(item.fullName);
  if (legacyName) return legacyName;
  return "";
};

export const resolveAddressEmailAddress = (
  item?: Pick<UserAddressLike, "emailAddress"> | null,
  fallbackEmailAddress = ""
) => {
  const explicitEmail = normalizeText(item?.emailAddress);
  if (explicitEmail) return explicitEmail;
  return normalizeText(fallbackEmailAddress);
};

export const formatAddressSummary = (
  item: Partial<
    Pick<
      UserAddress,
      | "streetName"
      | "houseNumber"
      | "building"
      | "district"
      | "city"
      | "province"
      | "postalCode"
    >
  >
) =>
  [
    `${item.streetName || ""} ${item.houseNumber || ""}`.trim(),
    item.building || "",
    item.district,
    item.city,
    item.province,
    item.postalCode,
  ]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(", ");

export const toUserAddressForm = (
  address?: UserAddressLike | null,
  fallbackEmailAddress = ""
): UserAddressForm => {
  const nameFromFields = buildFullName(address?.firstName, address?.lastName);
  const fullName = nameFromFields || normalizeText(address?.fullName);
  const splitName = splitFullName(fullName);
  return {
    firstName: splitName.firstName,
    lastName: splitName.lastName,
    emailAddress: resolveAddressEmailAddress(address, fallbackEmailAddress),
    phoneNumber: normalizeText(address?.phoneNumber),
    province: normalizeText(address?.province),
    city: normalizeText(address?.city),
    district: normalizeText(address?.district),
    postalCode: normalizeText(address?.postalCode),
    streetName: normalizeText(address?.streetName),
    building: normalizeText(address?.building),
    houseNumber: normalizeText(address?.houseNumber),
    otherDetails: normalizeText(address?.otherDetails),
    markAs:
      normalizeText(address?.markAs).toUpperCase() === "OFFICE" ? "OFFICE" : "HOME",
    isPrimary: Boolean(address?.isPrimary),
    isStore: Boolean(address?.isStore),
    isReturn: Boolean(address?.isReturn),
  };
};

export const toUserAddressPayload = (
  form: Partial<
    UserAddressPayload & {
      firstName?: string;
      lastName?: string;
      emailAddress?: string;
    }
  >
): UserAddressPayload => ({
  fullName:
    normalizeText(form.fullName) || buildFullName(form.firstName, form.lastName),
  phoneNumber: normalizeText(form.phoneNumber),
  province: normalizeText(form.province),
  city: normalizeText(form.city),
  district: normalizeText(form.district),
  postalCode: normalizeText(form.postalCode),
  streetName: normalizeText(form.streetName),
  building: normalizeText(form.building),
  houseNumber: normalizeText(form.houseNumber),
  otherDetails: normalizeText(form.otherDetails),
  markAs:
    normalizeText(form.markAs).toUpperCase() === "OFFICE"
      ? ("OFFICE" as UserAddressMarkAs)
      : ("HOME" as UserAddressMarkAs),
  isPrimary: Boolean(form.isPrimary),
  isStore: Boolean(form.isStore),
  isReturn: Boolean(form.isReturn),
});

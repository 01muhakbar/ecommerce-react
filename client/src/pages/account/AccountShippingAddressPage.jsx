import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from "../../api/userAddresses.ts";
import idRegions from "../../data/id-regions.json";

const POSTAL_CODE_REGEX = /^\d{5}$/;

const EMPTY_FORM = {
  fullName: "",
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
};

const toForm = (address) => ({
  fullName: String(address?.fullName || ""),
  phoneNumber: String(address?.phoneNumber || ""),
  province: String(address?.province || ""),
  city: String(address?.city || ""),
  district: String(address?.district || ""),
  postalCode: String(address?.postalCode || ""),
  streetName: String(address?.streetName || ""),
  building: String(address?.building || ""),
  houseNumber: String(address?.houseNumber || ""),
  otherDetails: String(address?.otherDetails || ""),
  markAs: address?.markAs === "OFFICE" ? "OFFICE" : "HOME",
  isPrimary: Boolean(address?.isPrimary),
  isStore: Boolean(address?.isStore),
  isReturn: Boolean(address?.isReturn),
});

const formatAddressSummary = (item) =>
  [
    `${item.streetName} ${item.houseNumber}`.trim(),
    item.building || "",
    item.district,
    item.city,
    item.province,
    item.postalCode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

const REGION_DATA = Array.isArray(idRegions?.provinces) ? idRegions.provinces : [];

const withFallbackOption = (items, selectedValue) => {
  const normalizedSelected = String(selectedValue || "").trim();
  if (!normalizedSelected) return items;
  if (items.includes(normalizedSelected)) return items;
  return [normalizedSelected, ...items];
};

export default function AccountShippingAddressPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [editingId, setEditingId] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);

  const provinceOptions = useMemo(
    () => withFallbackOption(REGION_DATA.map((item) => String(item?.name || "")).filter(Boolean), form.province),
    [form.province]
  );

  const cityOptions = useMemo(() => {
    const province = REGION_DATA.find((item) => String(item?.name || "") === String(form.province || ""));
    const items = Array.isArray(province?.cities)
      ? province.cities.map((item) => String(item?.name || "")).filter(Boolean)
      : [];
    return withFallbackOption(items, form.city);
  }, [form.province, form.city]);

  const districtOptions = useMemo(() => {
    const province = REGION_DATA.find((item) => String(item?.name || "") === String(form.province || ""));
    const city = Array.isArray(province?.cities)
      ? province.cities.find((item) => String(item?.name || "") === String(form.city || ""))
      : null;
    const items = Array.isArray(city?.districts)
      ? city.districts.map((item) => String(item || "")).filter(Boolean)
      : [];
    return withFallbackOption(items, form.district);
  }, [form.province, form.city, form.district]);

  const loadAddresses = async (withLoading = true) => {
    if (withLoading) setIsLoading(true);
    setError("");
    try {
      const items = await listAddresses();
      setAddresses(items);
      return items;
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load addresses.");
      return [];
    } finally {
      if (withLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const idParam = Number(searchParams.get("id"));
    if (!Number.isFinite(idParam) || idParam <= 0) return;
    const target = addresses.find((item) => Number(item.id) === idParam);
    if (!target) return;
    setEditingId(idParam);
    setForm(toForm(target));
  }, [isLoading, searchParams, addresses]);

  const isFormValid = useMemo(() => {
    const requiredValues = [
      form.fullName,
      form.phoneNumber,
      form.province,
      form.city,
      form.district,
      form.postalCode,
      form.streetName,
      form.houseNumber,
    ];
    const allRequiredFilled = requiredValues.every((value) => String(value || "").trim());
    return allRequiredFilled && POSTAL_CODE_REGEX.test(String(form.postalCode || "").trim());
  }, [form]);

  const handleTextChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleProvinceChange = (event) => {
    const nextProvince = String(event.target.value || "");
    setForm((prev) => ({
      ...prev,
      province: nextProvince,
      city: "",
      district: "",
    }));
  };

  const handleCityChange = (event) => {
    const nextCity = String(event.target.value || "");
    setForm((prev) => ({
      ...prev,
      city: nextCity,
      district: "",
    }));
  };

  const handleCheckboxChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.checked }));
  };

  const resetForm = () => {
    setEditingId(0);
    setForm(EMPTY_FORM);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("id");
      return next;
    });
  };

  const handleEditAddress = (item) => {
    const id = Number(item?.id || 0);
    if (!id) return;
    setEditingId(id);
    setForm(toForm(item));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("id", String(id));
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    if (!isFormValid) {
      setStatus({ type: "error", message: "Please complete required fields correctly." });
      return;
    }

    const payload = {
      ...form,
      fullName: String(form.fullName || "").trim(),
      phoneNumber: String(form.phoneNumber || "").trim(),
      province: String(form.province || "").trim(),
      city: String(form.city || "").trim(),
      district: String(form.district || "").trim(),
      postalCode: String(form.postalCode || "").trim(),
      streetName: String(form.streetName || "").trim(),
      building: String(form.building || "").trim(),
      houseNumber: String(form.houseNumber || "").trim(),
      otherDetails: String(form.otherDetails || "").trim(),
      markAs: form.markAs === "OFFICE" ? "OFFICE" : "HOME",
      isPrimary: Boolean(form.isPrimary),
      isStore: Boolean(form.isStore),
      isReturn: Boolean(form.isReturn),
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateAddress(editingId, payload);
        setStatus({ type: "success", message: "Address updated successfully." });
      } else {
        await createAddress(payload);
        setStatus({ type: "success", message: "Address created successfully." });
      }
      await loadAddresses(false);
      resetForm();
    } catch (requestError) {
      setStatus({
        type: "error",
        message: requestError?.response?.data?.message || "Failed to save address.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    const id = Number(item?.id || 0);
    if (!id) return;
    setStatus(null);
    setIsDeletingId(id);
    try {
      await deleteAddress(id);
      await loadAddresses(false);
      if (editingId === id) resetForm();
      setStatus({ type: "success", message: "Address deleted successfully." });
    } catch (requestError) {
      setStatus({
        type: "error",
        message: requestError?.response?.data?.message || "Failed to delete address.",
      });
    } finally {
      setIsDeletingId(0);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Shipping Address</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage address details for delivery, store, and return.
          </p>
        </div>
        <Link
          to="/user/my-account"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to My Account
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Loading addresses...
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {editingId ? "Edit Address" : "Add New Address"}
            </h2>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Create New
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={form.fullName}
                onChange={handleTextChange("fullName")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Full Name *"
              />
              <input
                type="text"
                value={form.phoneNumber}
                onChange={handleTextChange("phoneNumber")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Phone Number *"
              />
              <select
                value={form.province}
                onChange={handleProvinceChange}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select Province *</option>
                {provinceOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={form.city}
                onChange={handleCityChange}
                disabled={!form.province}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">{form.province ? "Select City *" : "Select Province first"}</option>
                {cityOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={form.district}
                onChange={handleTextChange("district")}
                disabled={!form.city}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">{form.city ? "Select District *" : "Select City first"}</option>
                {districtOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={form.postalCode}
                onChange={handleTextChange("postalCode")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Postal Code (5 digits) *"
              />
              <input
                type="text"
                value={form.streetName}
                onChange={handleTextChange("streetName")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Street Name *"
              />
              <input
                type="text"
                value={form.houseNumber}
                onChange={handleTextChange("houseNumber")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="House Number *"
              />
              <input
                type="text"
                value={form.building}
                onChange={handleTextChange("building")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Building"
              />
            </div>

            <textarea
              value={form.otherDetails}
              onChange={handleTextChange("otherDetails")}
              className="h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Other Details (Block / Unit / Reference)"
            />

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Mark As
              </p>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="markAs"
                    checked={form.markAs === "HOME"}
                    onChange={() => setForm((prev) => ({ ...prev, markAs: "HOME" }))}
                  />
                  Home
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="markAs"
                    checked={form.markAs === "OFFICE"}
                    onChange={() => setForm((prev) => ({ ...prev, markAs: "OFFICE" }))}
                  />
                  Office
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={handleCheckboxChange("isPrimary")}
                />
                Set as Primary
              </label>
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isStore}
                  onChange={handleCheckboxChange("isStore")}
                />
                Set as Store
              </label>
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isReturn}
                  onChange={handleCheckboxChange("isReturn")}
                />
                Set as Return
              </label>
            </div>

            {form.isPrimary ? (
              <p className="text-xs text-emerald-700">
                This address will be used as default shipping address.
              </p>
            ) : null}

            {status ? (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  status.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {status.message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : editingId ? "Update Address" : "Save Address"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Saved Addresses</h2>
          {addresses.length === 0 ? (
            <p className="text-sm text-slate-500">No address saved yet.</p>
          ) : (
            <div className="space-y-3">
              {addresses.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-xl border p-3 ${
                    item.isPrimary ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{item.fullName}</p>
                      <p className="text-xs text-slate-500">{item.phoneNumber}</p>
                      <p className="mt-2 text-sm text-slate-700">{formatAddressSummary(item)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          {item.markAs}
                        </span>
                        {item.isPrimary ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                            Primary
                          </span>
                        ) : null}
                        {item.isStore ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
                            Store
                          </span>
                        ) : null}
                        {item.isReturn ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                            Return
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditAddress(item)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={isDeletingId === item.id}
                        className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

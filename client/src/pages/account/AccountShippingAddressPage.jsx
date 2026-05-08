import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from "../../api/userAddresses.ts";
import {
  getCityOptions,
  getDistrictOptions,
  getProvinceOptions,
} from "../../utils/idRegions.ts";
import {
  EMAIL_ADDRESS_REGEX,
  POSTAL_CODE_REGEX,
  createEmptyUserAddressForm,
  formatContactName,
  formatAddressSummary,
  resolveAddressEmailAddress,
  toUserAddressForm,
  toUserAddressPayload,
} from "../../utils/userAddress.ts";

export default function AccountShippingAddressPage() {
  const { user } = useOutletContext() || {};
  const accountEmail = String(user?.email || "").trim();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [editingId, setEditingId] = useState(0);
  const [form, setForm] = useState(() => createEmptyUserAddressForm(accountEmail));

  const provinceOptions = useMemo(
    () => getProvinceOptions(form.province),
    [form.province]
  );

  const cityOptions = useMemo(() => {
    return getCityOptions(form.province, form.city);
  }, [form.province, form.city]);

  const districtOptions = useMemo(() => {
    return getDistrictOptions(form.province, form.city, form.district);
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
    setForm(toUserAddressForm(target, accountEmail));
  }, [accountEmail, isLoading, searchParams, addresses]);

  useEffect(() => {
    if (!accountEmail) return;
    setForm((prev) => ({ ...prev, emailAddress: accountEmail }));
  }, [accountEmail]);

  const isFormValid = useMemo(() => {
    const requiredValues = [
      form.firstName,
      form.lastName,
      form.emailAddress,
      form.phoneNumber,
      form.province,
      form.city,
      form.district,
      form.postalCode,
      form.streetName,
      form.houseNumber,
    ];
    const allRequiredFilled = requiredValues.every((value) => String(value || "").trim());
    return (
      allRequiredFilled &&
      EMAIL_ADDRESS_REGEX.test(String(form.emailAddress || "").trim()) &&
      POSTAL_CODE_REGEX.test(String(form.postalCode || "").trim())
    );
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
    setForm(createEmptyUserAddressForm(accountEmail));
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
    setForm(toUserAddressForm(item, accountEmail));
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

    const payload = toUserAddressPayload(form);

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
                value={form.firstName}
                onChange={handleTextChange("firstName")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="First Name *"
              />
              <input
                type="text"
                value={form.lastName}
                onChange={handleTextChange("lastName")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Last Name *"
              />
              <input
                type="email"
                value={form.emailAddress}
                onChange={handleTextChange("emailAddress")}
                readOnly={Boolean(accountEmail)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50 read-only:text-slate-500"
                placeholder="Email Address *"
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
                <option value="">
                  {form.province ? "Select City/Regency *" : "Select Province first"}
                </option>
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
                <option value="">
                  {form.city ? "Select Subdistrict *" : "Select City/Regency first"}
                </option>
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

            <p className="text-xs text-slate-500">
              {accountEmail
                ? "Email address follows your account email and will be used for checkout updates."
                : "Add an email address for checkout updates."}
            </p>

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
                      <p className="text-sm font-semibold text-slate-900">
                        {formatContactName(item) || "No name"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {resolveAddressEmailAddress(item, accountEmail) || "No email provided"}
                      </p>
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

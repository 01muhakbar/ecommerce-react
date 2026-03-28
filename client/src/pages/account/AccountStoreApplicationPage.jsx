import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Save,
  SendHorizonal,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";
import { listSellerWorkspaceStores } from "../../api/sellerWorkspace.ts";
import {
  cancelUserStoreApplication,
  createEmptyStoreApplicationSnapshots,
  createUserStoreApplicationDraft,
  getCurrentUserStoreApplication,
  resubmitUserStoreApplication,
  submitUserStoreApplication,
  updateUserStoreApplicationDraft,
} from "../../api/userStoreApplications.ts";
import { createSellerWorkspaceRoutes } from "../../utils/sellerWorkspaceRoute.js";

const QUERY_KEY = ["user", "store-application", "current"];
const SELLER_STORES_QUERY_KEY = ["seller", "workspace", "stores"];

const STEP_CONFIG = [
  {
    code: "owner_identity",
    label: "Data Pemilik",
    description: "Identitas pemilik dan PIC utama untuk pengajuan toko.",
  },
  {
    code: "store_information",
    label: "Informasi Toko",
    description: "Nama toko, kategori, dan ringkasan usaha yang akan dijual.",
  },
  {
    code: "operational_address",
    label: "Alamat Operasional",
    description: "Alamat operasional dan kontak lokasi usaha.",
  },
  {
    code: "payout_payment",
    label: "Informasi Keuangan",
    description: "Tujuan pencairan dan data rekening operasional.",
  },
  {
    code: "compliance",
    label: "Kepatuhan",
    description: "Produk, deklarasi kepatuhan, dan persetujuan seller.",
  },
  {
    code: "review",
    label: "Ringkasan",
    description: "Periksa kembali data pengajuan sebelum dikirim ke admin.",
  },
];

const STATUS_BADGE_CLASS = {
  stone: "bg-slate-100 text-slate-700",
  warning: "bg-amber-100 text-amber-700",
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
};

const SECTION_CARD_CLASS = "rounded-2xl border border-slate-200 bg-white p-5";
const FIELD_CLASS =
  "mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";
const TEXTAREA_CLASS = `${FIELD_CLASS} min-h-[112px]`;

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toNullableText = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const toNumberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const createFormState = (application, user) => {
  const empty = createEmptyStoreApplicationSnapshots();
  if (!application) {
    return {
      ...empty,
      ownerIdentitySnapshot: {
        ...empty.ownerIdentitySnapshot,
        fullName: toNullableText(user?.name),
        operationalContactName: toNullableText(user?.name),
        email: toNullableText(user?.email),
        phoneNumber: toNullableText(user?.phoneNumber || user?.phone),
      },
      operationalAddressSnapshot: {
        ...empty.operationalAddressSnapshot,
        country: "Indonesia",
      },
      complianceSnapshot: {
        ...empty.complianceSnapshot,
        supportEmail: toNullableText(user?.email),
        supportPhone: toNullableText(user?.phoneNumber || user?.phone),
      },
    };
  }

  return {
    ownerIdentitySnapshot: {
      ...empty.ownerIdentitySnapshot,
      ...(application.ownerIdentitySnapshot || {}),
    },
    storeInformationSnapshot: {
      ...empty.storeInformationSnapshot,
      ...(application.storeInformationSnapshot || {}),
    },
    operationalAddressSnapshot: {
      ...empty.operationalAddressSnapshot,
      ...(application.operationalAddressSnapshot || {}),
    },
    payoutPaymentSnapshot: {
      ...empty.payoutPaymentSnapshot,
      ...(application.payoutPaymentSnapshot || {}),
    },
    complianceSnapshot: {
      ...empty.complianceSnapshot,
      ...(application.complianceSnapshot || {}),
    },
  };
};

const buildDraftPayload = (form, currentStep) => ({
  currentStep,
  ownerIdentitySnapshot: {
    fullName: toNullableText(form.ownerIdentitySnapshot.fullName),
    operationalContactName: toNullableText(form.ownerIdentitySnapshot.operationalContactName),
    email: toNullableText(form.ownerIdentitySnapshot.email),
    phoneNumber: toNullableText(form.ownerIdentitySnapshot.phoneNumber),
    birthDate: toNullableText(form.ownerIdentitySnapshot.birthDate),
    identityType: toNullableText(form.ownerIdentitySnapshot.identityType),
    identityLegalName: toNullableText(form.ownerIdentitySnapshot.identityLegalName),
  },
  storeInformationSnapshot: {
    storeName: toNullableText(form.storeInformationSnapshot.storeName),
    storeSlug: toNullableText(form.storeInformationSnapshot.storeSlug),
    storeCategory: toNullableText(form.storeInformationSnapshot.storeCategory),
    description: toNullableText(form.storeInformationSnapshot.description),
    sellerType: toNullableText(form.storeInformationSnapshot.sellerType),
    isSelfProduced: Boolean(form.storeInformationSnapshot.isSelfProduced),
    initialProductCount: toNumberOrNull(form.storeInformationSnapshot.initialProductCount),
  },
  operationalAddressSnapshot: {
    contactName: toNullableText(form.operationalAddressSnapshot.contactName),
    phoneNumber: toNullableText(form.operationalAddressSnapshot.phoneNumber),
    addressLine1: toNullableText(form.operationalAddressSnapshot.addressLine1),
    addressLine2: toNullableText(form.operationalAddressSnapshot.addressLine2),
    city: toNullableText(form.operationalAddressSnapshot.city),
    province: toNullableText(form.operationalAddressSnapshot.province),
    district: toNullableText(form.operationalAddressSnapshot.district),
    postalCode: toNullableText(form.operationalAddressSnapshot.postalCode),
    country: toNullableText(form.operationalAddressSnapshot.country),
    notes: toNullableText(form.operationalAddressSnapshot.notes),
  },
  payoutPaymentSnapshot: {
    payoutMethod: toNullableText(form.payoutPaymentSnapshot.payoutMethod),
    accountHolderName: toNullableText(form.payoutPaymentSnapshot.accountHolderName),
    accountNumber: toNullableText(form.payoutPaymentSnapshot.accountNumber),
    bankName: toNullableText(form.payoutPaymentSnapshot.bankName),
    qrisImageUrl: toNullableText(form.payoutPaymentSnapshot.qrisImageUrl),
    accountHolderMatchesIdentity: Boolean(
      form.payoutPaymentSnapshot.accountHolderMatchesIdentity
    ),
  },
  complianceSnapshot: {
    supportEmail: toNullableText(form.complianceSnapshot.supportEmail),
    supportPhone: toNullableText(form.complianceSnapshot.supportPhone),
    taxId: toNullableText(form.complianceSnapshot.taxId),
    identityNumber: toNullableText(form.complianceSnapshot.identityNumber),
    productTypes: toNullableText(form.complianceSnapshot.productTypes),
    brandOwnershipType: toNullableText(form.complianceSnapshot.brandOwnershipType),
    authenticityConfirmed: Boolean(form.complianceSnapshot.authenticityConfirmed),
    prohibitedGoodsConfirmed: Boolean(form.complianceSnapshot.prohibitedGoodsConfirmed),
    websiteUrl: toNullableText(form.complianceSnapshot.websiteUrl),
    socialMediaUrl: toNullableText(form.complianceSnapshot.socialMediaUrl),
    notes: toNullableText(form.complianceSnapshot.notes),
    agreedToTerms: Boolean(form.complianceSnapshot.agreedToTerms),
    agreedToAdminReview: Boolean(form.complianceSnapshot.agreedToAdminReview),
    agreedToPlatformPolicy: Boolean(form.complianceSnapshot.agreedToPlatformPolicy),
    understandsStoreInactiveUntilApproved: Boolean(
      form.complianceSnapshot.understandsStoreInactiveUntilApproved
    ),
  },
});

const buildLocalCompleteness = (form) => {
  const missingFields = [];

  if (!toText(form.ownerIdentitySnapshot.fullName)) {
    missingFields.push({ key: "ownerIdentitySnapshot.fullName", label: "Nama lengkap" });
  }
  if (!toText(form.ownerIdentitySnapshot.email)) {
    missingFields.push({ key: "ownerIdentitySnapshot.email", label: "Email aktif" });
  }
  if (!toText(form.storeInformationSnapshot.storeName)) {
    missingFields.push({ key: "storeInformationSnapshot.storeName", label: "Nama toko" });
  }
  if (!toText(form.operationalAddressSnapshot.addressLine1)) {
    missingFields.push({
      key: "operationalAddressSnapshot.addressLine1",
      label: "Alamat operasional",
    });
  }
  if (!toText(form.operationalAddressSnapshot.city)) {
    missingFields.push({ key: "operationalAddressSnapshot.city", label: "Kota / Kabupaten" });
  }
  if (!toText(form.operationalAddressSnapshot.province)) {
    missingFields.push({ key: "operationalAddressSnapshot.province", label: "Provinsi" });
  }
  if (!toText(form.operationalAddressSnapshot.country)) {
    missingFields.push({ key: "operationalAddressSnapshot.country", label: "Negara" });
  }
  if (!toText(form.payoutPaymentSnapshot.payoutMethod)) {
    missingFields.push({ key: "payoutPaymentSnapshot.payoutMethod", label: "Channel pencairan" });
  }
  if (!toText(form.payoutPaymentSnapshot.accountHolderName)) {
    missingFields.push({
      key: "payoutPaymentSnapshot.accountHolderName",
      label: "Nama pemilik rekening",
    });
  }
  if (!toText(form.complianceSnapshot.supportEmail)) {
    missingFields.push({ key: "complianceSnapshot.supportEmail", label: "Email dukungan" });
  }
  if (!form.complianceSnapshot.agreedToTerms) {
    missingFields.push({
      key: "complianceSnapshot.agreedToTerms",
      label: "Persetujuan syarat seller",
    });
  }
  if (!form.complianceSnapshot.agreedToAdminReview) {
    missingFields.push({
      key: "complianceSnapshot.agreedToAdminReview",
      label: "Persetujuan review admin",
    });
  }
  if (!form.complianceSnapshot.agreedToPlatformPolicy) {
    missingFields.push({
      key: "complianceSnapshot.agreedToPlatformPolicy",
      label: "Persetujuan kebijakan platform",
    });
  }
  if (!form.complianceSnapshot.understandsStoreInactiveUntilApproved) {
    missingFields.push({
      key: "complianceSnapshot.understandsStoreInactiveUntilApproved",
      label: "Konfirmasi toko belum aktif",
    });
  }
  if (!form.complianceSnapshot.authenticityConfirmed) {
    missingFields.push({
      key: "complianceSnapshot.authenticityConfirmed",
      label: "Pernyataan keaslian produk",
    });
  }
  if (!form.complianceSnapshot.prohibitedGoodsConfirmed) {
    missingFields.push({
      key: "complianceSnapshot.prohibitedGoodsConfirmed",
      label: "Pernyataan barang terlarang",
    });
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
};

const getRequestErrorMessage = (error, fallback) => {
  const payload = error?.response?.data || {};
  if (String(payload?.code || "").toUpperCase() === "STORE_APPLICATION_INCOMPLETE") {
    const labels = Array.isArray(payload?.details?.missingFields)
      ? payload.details.missingFields.map((entry) => entry?.label).filter(Boolean)
      : [];
    if (labels.length) {
      return `Lengkapi field wajib sebelum submit: ${labels.join(", ")}.`;
    }
  }
  if (String(payload?.code || "").toUpperCase() === "OPEN_STORE_APPLICATION_EXISTS") {
    return "Masih ada pengajuan toko aktif untuk akun ini. Lanjutkan pengajuan yang ada.";
  }
  if (String(payload?.code || "").toUpperCase() === "STORE_ALREADY_EXISTS_FOR_USER") {
    return "Akun ini sudah memiliki store. Gunakan Seller Workspace yang tersedia.";
  }
  return payload?.message || error?.message || fallback;
};

function StatusBadge({ label, tone = "stone" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_BADGE_CLASS[tone] || STATUS_BADGE_CLASS.stone
      }`}
    >
      {label}
    </span>
  );
}

function Field({ label, hint, multiline = false, className = "", ...props }) {
  return (
    <label className={className}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {multiline ? (
        <textarea {...props} className={TEXTAREA_CLASS} />
      ) : (
        <input {...props} className={FIELD_CLASS} />
      )}
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </label>
  );
}

function SelectField({ label, hint, options, className = "", ...props }) {
  return (
    <label className={className}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select {...props} className={FIELD_CLASS}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </label>
  );
}

function CheckboxField({ label, hint, checked, onChange, disabled = false }) {
  return (
    <label className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {hint ? <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span> : null}
      </span>
    </label>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-900">{toText(value, "-")}</p>
    </div>
  );
}

function InfoNotice({ tone = "info", children }) {
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-sky-200 bg-sky-50 text-sky-700";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>{children}</div>;
}

function SectionHeader({ title, description, eyebrow = "Store Onboarding" }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export default function AccountStoreApplicationPage() {
  const queryClient = useQueryClient();
  const { user } = useOutletContext() || {};
  const [activeStep, setActiveStep] = useState("owner_identity");
  const [form, setForm] = useState(() => createFormState(null, user));
  const [flash, setFlash] = useState(null);

  const applicationQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getCurrentUserStoreApplication,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const sellerStoresQuery = useQuery({
    queryKey: SELLER_STORES_QUERY_KEY,
    queryFn: listSellerWorkspaceStores,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const application = applicationQuery.data || null;
  const sellerStores = Array.isArray(sellerStoresQuery.data) ? sellerStoresQuery.data : [];

  const ownerStore = useMemo(() => {
    const owned = sellerStores.filter((entry) => entry?.access?.isOwner);
    return (
      owned.sort((left, right) => {
        const leftActive = String(left?.store?.status || "").toUpperCase() === "ACTIVE" ? 1 : 0;
        const rightActive =
          String(right?.store?.status || "").toUpperCase() === "ACTIVE" ? 1 : 0;
        if (leftActive !== rightActive) return rightActive - leftActive;
        return String(left?.store?.name || "").localeCompare(String(right?.store?.name || ""));
      })[0] || null
    );
  }, [sellerStores]);

  const workspaceHref = ownerStore
    ? createSellerWorkspaceRoutes(ownerStore.store).home()
    : sellerStores[0]
      ? createSellerWorkspaceRoutes(sellerStores[0].store).home()
      : null;

  useEffect(() => {
    setForm(createFormState(application, user));
    setActiveStep(application?.currentStep || "owner_identity");
  }, [application, user]);

  const editable = application?.workflow?.canEdit ?? false;
  const currentStepIndex = STEP_CONFIG.findIndex((step) => step.code === activeStep);
  const localCompleteness = useMemo(() => buildLocalCompleteness(form), [form]);

  const updateSection = (sectionKey, field, value) => {
    setForm((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        [field]: value,
      },
    }));
  };

  const hydrateApplication = (nextApplication, successMessage) => {
    queryClient.setQueryData(QUERY_KEY, nextApplication);
    setFlash(successMessage ? { type: "success", message: successMessage } : null);
  };

  const createDraftMutation = useMutation({
    mutationFn: () =>
      createUserStoreApplicationDraft({
        ownerIdentitySnapshot: {
          fullName: toNullableText(user?.name),
          operationalContactName: toNullableText(user?.name),
          email: toNullableText(user?.email),
          phoneNumber: toNullableText(user?.phoneNumber || user?.phone),
        },
        operationalAddressSnapshot: {
          country: "Indonesia",
        },
        complianceSnapshot: {
          supportEmail: toNullableText(user?.email),
          supportPhone: toNullableText(user?.phoneNumber || user?.phone),
        },
      }),
    onSuccess: (nextApplication) => {
      hydrateApplication(nextApplication, "Draft pengajuan toko berhasil dibuat.");
    },
    onError: (error) => {
      setFlash({
        type: "error",
        message: getRequestErrorMessage(
          error,
          "Gagal membuat draft pengajuan toko."
        ),
      });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: () => {
      if (!application?.id) throw new Error("Store application draft is missing.");
      return updateUserStoreApplicationDraft(
        application.id,
        buildDraftPayload(form, activeStep)
      );
    },
    onSuccess: (nextApplication) => {
      hydrateApplication(nextApplication, "Draft pengajuan toko berhasil disimpan.");
    },
    onError: (error) => {
      setFlash({
        type: "error",
        message: getRequestErrorMessage(error, "Gagal menyimpan draft pengajuan toko."),
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!application?.id) throw new Error("Store application draft is missing.");
      await updateUserStoreApplicationDraft(
        application.id,
        buildDraftPayload(form, "review")
      );
      return application.status === "revision_requested"
        ? resubmitUserStoreApplication(application.id)
        : submitUserStoreApplication(application.id);
    },
    onSuccess: (nextApplication) => {
      hydrateApplication(
        nextApplication,
        application?.status === "revision_requested"
          ? "Pengajuan toko berhasil dikirim ulang untuk ditinjau admin."
          : "Pengajuan toko berhasil dikirim untuk ditinjau admin."
      );
      setActiveStep("review");
    },
    onError: (error) => {
      setFlash({
        type: "error",
        message: getRequestErrorMessage(error, "Gagal mengirim pengajuan toko."),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!application?.id) throw new Error("Store application is missing.");
      return cancelUserStoreApplication(application.id);
    },
    onSuccess: (nextApplication) => {
      hydrateApplication(nextApplication, "Pengajuan toko berhasil dibatalkan.");
    },
    onError: (error) => {
      setFlash({
        type: "error",
        message: getRequestErrorMessage(error, "Gagal membatalkan pengajuan toko."),
      });
    },
  });

  const isBusy =
    createDraftMutation.isPending ||
    saveDraftMutation.isPending ||
    submitMutation.isPending ||
    cancelMutation.isPending;

  const handleRestart = () => {
    setFlash(null);
    createDraftMutation.mutate();
  };

  const handleCancelApplication = () => {
    if (!application?.workflow?.canCancel || isBusy) return;
    if (!window.confirm("Batalkan pengajuan toko ini? Draft atau status aktif akan ditutup.")) {
      return;
    }
    setFlash(null);
    cancelMutation.mutate();
  };

  const renderOwnerSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">Data Pemilik / Identitas</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Isi data identitas utama yang akan dipakai admin untuk memverifikasi pengajuan toko.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Nama Lengkap Sesuai Identitas"
          value={form.ownerIdentitySnapshot.fullName || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "fullName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Nama lengkap"
        />
        <Field
          label="Nama PIC / Operasional"
          value={form.ownerIdentitySnapshot.operationalContactName || ""}
          onChange={(event) =>
            updateSection(
              "ownerIdentitySnapshot",
              "operationalContactName",
              event.target.value
            )
          }
          disabled={!editable || isBusy}
          placeholder="Nama PIC"
        />
        <Field
          label="Email Aktif"
          value={form.ownerIdentitySnapshot.email || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "email", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="nama@email.com"
          type="email"
        />
        <Field
          label="Nomor WhatsApp / Telepon"
          value={form.ownerIdentitySnapshot.phoneNumber || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "phoneNumber", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="08xxxxxxxxxx"
        />
        <Field
          label="Tanggal Lahir"
          value={form.ownerIdentitySnapshot.birthDate || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "birthDate", event.target.value)
          }
          disabled={!editable || isBusy}
          type="date"
        />
        <SelectField
          label="Jenis Identitas"
          value={form.ownerIdentitySnapshot.identityType || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "identityType", event.target.value)
          }
          disabled={!editable || isBusy}
          options={[
            { value: "", label: "Pilih jenis identitas" },
            { value: "KTP", label: "KTP" },
            { value: "SIM", label: "SIM" },
            { value: "PASSPORT", label: "Paspor" },
            { value: "OTHER", label: "Lainnya" },
          ]}
        />
        <Field
          label="Nomor Identitas"
          value={form.complianceSnapshot.identityNumber || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "identityNumber", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Nomor identitas"
        />
        <Field
          label="Nama Sesuai Identitas"
          value={form.ownerIdentitySnapshot.identityLegalName || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "identityLegalName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Nama legal"
        />
      </div>
    </section>
  );

  const renderStoreSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">Informasi Toko</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Data ini menjadi snapshot awal untuk review admin. Belum membuat store publik atau seller
        workspace secara otomatis.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Nama Toko"
          value={form.storeInformationSnapshot.storeName || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "storeName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Nama toko"
        />
        <Field
          label="Slug / Handle Toko"
          value={form.storeInformationSnapshot.storeSlug || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "storeSlug", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="contoh-toko"
          hint="Opsional. Gunakan huruf kecil dan tanda hubung bila ingin mengusulkan handle toko."
        />
        <Field
          label="Kategori Usaha Utama"
          value={form.storeInformationSnapshot.storeCategory || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "storeCategory", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Fashion, makanan, elektronik, dll."
        />
        <SelectField
          label="Jenis Penjual"
          value={form.storeInformationSnapshot.sellerType || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "sellerType", event.target.value)
          }
          disabled={!editable || isBusy}
          options={[
            { value: "", label: "Pilih jenis penjual" },
            { value: "INDIVIDUAL", label: "Individual" },
            { value: "UMKM", label: "UMKM" },
            { value: "COMPANY", label: "Perusahaan" },
            { value: "DISTRIBUTOR", label: "Distributor" },
          ]}
        />
        <SelectField
          label="Produksi Sendiri"
          value={form.storeInformationSnapshot.isSelfProduced ? "yes" : "no"}
          onChange={(event) =>
            updateSection(
              "storeInformationSnapshot",
              "isSelfProduced",
              event.target.value === "yes"
            )
          }
          disabled={!editable || isBusy}
          options={[
            { value: "yes", label: "Ya" },
            { value: "no", label: "Tidak" },
          ]}
        />
        <Field
          label="Estimasi Jumlah Produk Awal"
          value={form.storeInformationSnapshot.initialProductCount ?? ""}
          onChange={(event) =>
            updateSection(
              "storeInformationSnapshot",
              "initialProductCount",
              event.target.value
            )
          }
          disabled={!editable || isBusy}
          placeholder="0"
          type="number"
          min="0"
        />
        <Field
          label="Deskripsi Toko"
          multiline
          className="md:col-span-2"
          value={form.storeInformationSnapshot.description || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "description", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Ringkas produk dan value toko Anda"
        />
      </div>
    </section>
  );

  const renderAddressSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">Alamat Operasional</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Tambahkan alamat operasional yang dipakai untuk koordinasi operasional toko.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Nama Penanggung Jawab"
          value={form.operationalAddressSnapshot.contactName || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "contactName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Nama penanggung jawab"
        />
        <Field
          label="Telepon Operasional"
          value={form.operationalAddressSnapshot.phoneNumber || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "phoneNumber", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="08xxxxxxxxxx"
        />
        <Field
          label="Alamat Lengkap"
          className="md:col-span-2"
          value={form.operationalAddressSnapshot.addressLine1 || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "addressLine1", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Jalan, nomor, RT/RW"
        />
        <Field
          label="Alamat Tambahan"
          className="md:col-span-2"
          value={form.operationalAddressSnapshot.addressLine2 || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "addressLine2", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Blok, unit, patokan, dll."
        />
        <Field
          label="Provinsi"
          value={form.operationalAddressSnapshot.province || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "province", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Provinsi"
        />
        <Field
          label="Kota / Kabupaten"
          value={form.operationalAddressSnapshot.city || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "city", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Kota / Kabupaten"
        />
        <Field
          label="Kecamatan"
          value={form.operationalAddressSnapshot.district || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "district", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Kecamatan"
        />
        <Field
          label="Kode Pos"
          value={form.operationalAddressSnapshot.postalCode || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "postalCode", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Kode pos"
        />
        <Field
          label="Negara"
          value={form.operationalAddressSnapshot.country || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "country", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Indonesia"
        />
        <Field
          label="Catatan Alamat"
          multiline
          className="md:col-span-2"
          value={form.operationalAddressSnapshot.notes || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "notes", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Catatan tambahan untuk verifikasi alamat"
        />
      </div>
    </section>
  );

  const renderPayoutSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">Informasi Keuangan / Pencairan</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Simpan informasi rekening dan channel pencairan yang direncanakan untuk toko.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Nama Pemilik Rekening"
          value={form.payoutPaymentSnapshot.accountHolderName || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "accountHolderName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Nama pada rekening"
        />
        <Field
          label="Bank / Channel"
          value={form.payoutPaymentSnapshot.bankName || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "bankName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="BCA, BRI, SeaBank, QRIS, dll."
        />
        <Field
          label="Metode Pencairan"
          value={form.payoutPaymentSnapshot.payoutMethod || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "payoutMethod", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Transfer bank, QRIS, e-wallet, dll."
        />
        <Field
          label="Nomor Rekening"
          value={form.payoutPaymentSnapshot.accountNumber || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "accountNumber", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Nomor rekening"
        />
        <Field
          label="NPWP"
          value={form.complianceSnapshot.taxId || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "taxId", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Opsional"
        />
        <Field
          label="URL QRIS"
          value={form.payoutPaymentSnapshot.qrisImageUrl || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "qrisImageUrl", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="https://..."
          hint="Opsional untuk sprint ini. Bisa diisi bila metode pencairan atau pembayaran memerlukan QRIS."
        />
        <div className="md:col-span-2">
          <CheckboxField
            label="Nama rekening sama dengan nama pada identitas"
            hint="Tandai jika rekening menggunakan nama legal yang sama dengan identitas pemilik."
            checked={Boolean(form.payoutPaymentSnapshot.accountHolderMatchesIdentity)}
            onChange={(event) =>
              updateSection(
                "payoutPaymentSnapshot",
                "accountHolderMatchesIdentity",
                event.target.checked
              )
            }
            disabled={!editable || isBusy}
          />
        </div>
      </div>
    </section>
  );

  const renderComplianceSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">
        Dokumen Pendukung, Kepatuhan, dan Persetujuan
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Jelaskan jenis produk, kontak dukungan, serta setujui pernyataan minimum sebelum submit.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Email Dukungan"
          value={form.complianceSnapshot.supportEmail || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "supportEmail", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="support@tokosaya.com"
          type="email"
        />
        <Field
          label="Telepon Dukungan"
          value={form.complianceSnapshot.supportPhone || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "supportPhone", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="08xxxxxxxxxx"
        />
        <Field
          label="Jenis Produk yang Dijual"
          value={form.complianceSnapshot.productTypes || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "productTypes", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Contoh: fashion muslim, makanan beku, gadget"
        />
        <SelectField
          label="Brand Sendiri / Pihak Ketiga"
          value={form.complianceSnapshot.brandOwnershipType || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "brandOwnershipType", event.target.value)
          }
          disabled={!editable || isBusy}
          options={[
            { value: "", label: "Pilih sumber brand" },
            { value: "OWN_BRAND", label: "Brand sendiri" },
            { value: "THIRD_PARTY", label: "Pihak ketiga" },
            { value: "MIXED", label: "Campuran" },
          ]}
        />
        <Field
          label="Website"
          value={form.complianceSnapshot.websiteUrl || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "websiteUrl", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="https://..."
        />
        <Field
          label="Link Media Sosial"
          value={form.complianceSnapshot.socialMediaUrl || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "socialMediaUrl", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="https://instagram.com/..."
        />
        <Field
          label="Catatan Tambahan"
          multiline
          className="md:col-span-2"
          value={form.complianceSnapshot.notes || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "notes", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Informasi tambahan untuk admin review"
        />
      </div>

      <div className="mt-5 grid gap-3">
        <CheckboxField
          label="Saya menyatakan produk yang diajukan asli dan dapat dipertanggungjawabkan."
          checked={Boolean(form.complianceSnapshot.authenticityConfirmed)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "authenticityConfirmed",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="Saya menyatakan tidak menjual barang terlarang atau melanggar kebijakan platform."
          checked={Boolean(form.complianceSnapshot.prohibitedGoodsConfirmed)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "prohibitedGoodsConfirmed",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="Saya menyatakan data yang saya isi benar."
          checked={Boolean(form.complianceSnapshot.agreedToTerms)}
          onChange={(event) =>
            updateSection("complianceSnapshot", "agreedToTerms", event.target.checked)
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="Saya setuju pengajuan ditinjau admin."
          checked={Boolean(form.complianceSnapshot.agreedToAdminReview)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "agreedToAdminReview",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="Saya setuju dengan kebijakan seller / platform."
          checked={Boolean(form.complianceSnapshot.agreedToPlatformPolicy)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "agreedToPlatformPolicy",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="Saya memahami toko belum aktif sebelum disetujui admin."
          checked={Boolean(form.complianceSnapshot.understandsStoreInactiveUntilApproved)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "understandsStoreInactiveUntilApproved",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
      </div>
    </section>
  );

  const renderReviewSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Ringkasan Pengajuan</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Periksa kembali seluruh data sebelum menyimpan draft terakhir atau mengirim pengajuan
            ke admin.
          </p>
        </div>
        {application?.statusMeta ? (
          <StatusBadge
            label={application.statusMeta.label}
            tone={application.statusMeta.tone}
          />
        ) : null}
      </div>

      <div className="mt-5 grid gap-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">1. Data Pemilik</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem label="Nama Lengkap" value={form.ownerIdentitySnapshot.fullName} />
            <SummaryItem
              label="Nama PIC / Operasional"
              value={form.ownerIdentitySnapshot.operationalContactName}
            />
            <SummaryItem label="Email Aktif" value={form.ownerIdentitySnapshot.email} />
            <SummaryItem label="WhatsApp / Telepon" value={form.ownerIdentitySnapshot.phoneNumber} />
            <SummaryItem label="Tanggal Lahir" value={form.ownerIdentitySnapshot.birthDate} />
            <SummaryItem label="Jenis Identitas" value={form.ownerIdentitySnapshot.identityType} />
            <SummaryItem label="Nomor Identitas" value={form.complianceSnapshot.identityNumber} />
            <SummaryItem
              label="Nama Sesuai Identitas"
              value={form.ownerIdentitySnapshot.identityLegalName}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">2. Informasi Toko</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem label="Nama Toko" value={form.storeInformationSnapshot.storeName} />
            <SummaryItem label="Slug / Handle" value={form.storeInformationSnapshot.storeSlug} />
            <SummaryItem
              label="Kategori Utama"
              value={form.storeInformationSnapshot.storeCategory}
            />
            <SummaryItem label="Jenis Penjual" value={form.storeInformationSnapshot.sellerType} />
            <SummaryItem
              label="Produksi Sendiri"
              value={form.storeInformationSnapshot.isSelfProduced ? "Ya" : "Tidak"}
            />
            <SummaryItem
              label="Estimasi Produk Awal"
              value={
                form.storeInformationSnapshot.initialProductCount !== null
                  ? String(form.storeInformationSnapshot.initialProductCount)
                  : null
              }
            />
            <SummaryItem
              label="Deskripsi Toko"
              value={form.storeInformationSnapshot.description}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">3. Alamat Operasional</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem
              label="Penanggung Jawab"
              value={form.operationalAddressSnapshot.contactName}
            />
            <SummaryItem
              label="Telepon Operasional"
              value={form.operationalAddressSnapshot.phoneNumber}
            />
            <SummaryItem
              label="Alamat Lengkap"
              value={form.operationalAddressSnapshot.addressLine1}
            />
            <SummaryItem
              label="Alamat Tambahan"
              value={form.operationalAddressSnapshot.addressLine2}
            />
            <SummaryItem label="Provinsi" value={form.operationalAddressSnapshot.province} />
            <SummaryItem label="Kota / Kabupaten" value={form.operationalAddressSnapshot.city} />
            <SummaryItem label="Kecamatan" value={form.operationalAddressSnapshot.district} />
            <SummaryItem label="Kode Pos" value={form.operationalAddressSnapshot.postalCode} />
            <SummaryItem label="Negara" value={form.operationalAddressSnapshot.country} />
            <SummaryItem label="Catatan Alamat" value={form.operationalAddressSnapshot.notes} />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">4. Informasi Keuangan</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem
              label="Nama Pemilik Rekening"
              value={form.payoutPaymentSnapshot.accountHolderName}
            />
            <SummaryItem label="Bank / Channel" value={form.payoutPaymentSnapshot.bankName} />
            <SummaryItem
              label="Metode Pencairan"
              value={form.payoutPaymentSnapshot.payoutMethod}
            />
            <SummaryItem label="Nomor Rekening" value={form.payoutPaymentSnapshot.accountNumber} />
            <SummaryItem label="NPWP" value={form.complianceSnapshot.taxId} />
            <SummaryItem label="URL QRIS" value={form.payoutPaymentSnapshot.qrisImageUrl} />
            <SummaryItem
              label="Nama Rekening Sama Dengan Identitas"
              value={
                form.payoutPaymentSnapshot.accountHolderMatchesIdentity ? "Ya" : "Tidak"
              }
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">5. Kepatuhan & Persetujuan</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem label="Email Dukungan" value={form.complianceSnapshot.supportEmail} />
            <SummaryItem label="Telepon Dukungan" value={form.complianceSnapshot.supportPhone} />
            <SummaryItem label="Jenis Produk" value={form.complianceSnapshot.productTypes} />
            <SummaryItem label="Sumber Brand" value={form.complianceSnapshot.brandOwnershipType} />
            <SummaryItem label="Website" value={form.complianceSnapshot.websiteUrl} />
            <SummaryItem label="Media Sosial" value={form.complianceSnapshot.socialMediaUrl} />
            <SummaryItem label="Catatan Tambahan" value={form.complianceSnapshot.notes} />
            <SummaryItem
              label="Keaslian Produk"
              value={form.complianceSnapshot.authenticityConfirmed ? "Ya" : "Belum"}
            />
            <SummaryItem
              label="Tidak Menjual Barang Terlarang"
              value={form.complianceSnapshot.prohibitedGoodsConfirmed ? "Ya" : "Belum"}
            />
            <SummaryItem
              label="Data Benar"
              value={form.complianceSnapshot.agreedToTerms ? "Ya" : "Belum"}
            />
            <SummaryItem
              label="Setuju Review Admin"
              value={form.complianceSnapshot.agreedToAdminReview ? "Ya" : "Belum"}
            />
            <SummaryItem
              label="Setuju Kebijakan Platform"
              value={form.complianceSnapshot.agreedToPlatformPolicy ? "Ya" : "Belum"}
            />
            <SummaryItem
              label="Memahami Toko Belum Aktif"
              value={
                form.complianceSnapshot.understandsStoreInactiveUntilApproved ? "Ya" : "Belum"
              }
            />
          </div>
        </div>
      </div>
    </section>
  );

  const renderCurrentStep = () => {
    switch (activeStep) {
      case "owner_identity":
        return renderOwnerSection();
      case "store_information":
        return renderStoreSection();
      case "operational_address":
        return renderAddressSection();
      case "payout_payment":
        return renderPayoutSection();
      case "compliance":
        return renderComplianceSection();
      default:
        return renderReviewSection();
    }
  };

  if (applicationQuery.isLoading || sellerStoresQuery.isLoading) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="Pengajuan Pembukaan Toko"
          description="Memuat status pengajuan toko dan akses seller workspace."
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Memuat pengajuan toko...
        </div>
      </div>
    );
  }

  if (applicationQuery.isError) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="Pengajuan Pembukaan Toko"
          description="Kami tidak dapat memuat status pengajuan toko saat ini."
        />
        <InfoNotice tone="error">
          {applicationQuery.error?.response?.data?.message ||
            applicationQuery.error?.message ||
            "Gagal memuat pengajuan toko."}
        </InfoNotice>
      </div>
    );
  }

  if (!application && ownerStore) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="Seller Workspace Sudah Tersedia"
          description="Akun ini sudah terhubung dengan store. Pengajuan toko baru tidak diperlukan lagi dari dashboard user."
        />
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">
                Store Owner
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {ownerStore.store.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Store ini sudah ada di boundary seller workspace. Lanjutkan pengelolaan toko dari
                workspace yang tersedia.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {workspaceHref ? (
                  <Link
                    to={workspaceHref}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Masuk ke Seller Workspace
                  </Link>
                ) : null}
                <Link
                  to="/user/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Kembali ke Dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="Mulai Jualan di Platform Kami"
          description="Ajukan pembukaan toko untuk mulai menjual produk Anda. Lengkapi data toko dan verifikasi identitas agar tim admin dapat meninjau pengajuan Anda."
        />
        {flash ? (
          <InfoNotice tone={flash.type === "error" ? "error" : "info"}>
            {flash.message}
          </InfoNotice>
        ) : null}
        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={SECTION_CARD_CLASS}>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Pengajuan toko belum dibuat</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Buat draft pengajuan lebih dulu. Draft ini menyimpan data ke backend
                  `store_applications`, jadi tetap aman saat browser di-refresh atau Anda kembali
                  lagi nanti.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setFlash(null);
                  createDraftMutation.mutate();
                }}
                disabled={createDraftMutation.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createDraftMutation.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Store className="h-4 w-4" />
                )}
                Ajukan Pembukaan Toko
              </button>
              <Link
                to="/user/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Dashboard
              </Link>
            </div>
          </div>

          <aside className={SECTION_CARD_CLASS}>
            <h2 className="text-lg font-semibold text-slate-950">Section Minimum</h2>
            <div className="mt-4 grid gap-3">
              {STEP_CONFIG.map((step, index) => (
                <div key={step.code} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Langkah {index + 1}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{step.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    );
  }

  const readOnlyStatus = !editable;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Pengajuan Pembukaan Toko"
        description="Lengkapi data toko, simpan draft kapan saja, lalu kirim pengajuan untuk ditinjau admin. Status backend tetap menjadi source of truth untuk progress pengajuan."
      />

      {flash ? (
        <InfoNotice tone={flash.type === "error" ? "error" : "info"}>{flash.message}</InfoNotice>
      ) : null}

      {application.revisionNote ? (
        <InfoNotice tone="warning">Catatan revisi admin: {application.revisionNote}</InfoNotice>
      ) : null}

      {application.rejectReason ? (
        <InfoNotice tone="error">Alasan penolakan terakhir: {application.rejectReason}</InfoNotice>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <aside className="space-y-5">
          <div className={SECTION_CARD_CLASS}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Status Pengajuan
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">
                  {application.statusMeta.label}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {application.statusMeta.description}
                </p>
              </div>
              <StatusBadge
                label={application.statusMeta.label}
                tone={application.statusMeta.tone}
              />
            </div>

            <div className="mt-5 grid gap-3">
              <SummaryItem label="Current Step" value={application.currentStepMeta.label} />
              <SummaryItem
                label="Kelengkapan Backend"
                value={`${application.completeness.completedFields}/${application.completeness.totalFields}`}
              />
              <SummaryItem label="Terakhir Diupdate" value={formatDateTime(application.updatedAt)} />
              <SummaryItem label="Dikirim" value={formatDateTime(application.submittedAt)} />
              <SummaryItem label="Direview" value={formatDateTime(application.reviewedAt)} />
            </div>

            {application.workflow?.sourceOfTruth ? (
              <p className="mt-4 text-xs leading-5 text-slate-500">
                {application.workflow.sourceOfTruth}
              </p>
            ) : null}
          </div>

          <div className={SECTION_CARD_CLASS}>
            <h2 className="text-lg font-semibold text-slate-950">Aksi</h2>
            <div className="mt-4 flex flex-col gap-3">
              {application.status === "approved" ? (
                workspaceHref ? (
                  <Link
                    to={workspaceHref}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Masuk ke Seller Workspace
                  </Link>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Pengajuan sudah disetujui. Jika seller workspace belum muncul, muat ulang
                    halaman ini atau dashboard untuk menarik boundary seller terbaru dari backend.
                  </div>
                )
              ) : null}

              {(application.status === "rejected" || application.status === "cancelled") &&
              !ownerStore ? (
                <button
                  type="button"
                  onClick={handleRestart}
                  disabled={createDraftMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createDraftMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Store className="h-4 w-4" />
                  )}
                  {application.status === "rejected" ? "Ajukan Ulang" : "Ajukan Pembukaan Toko"}
                </button>
              ) : null}

              {application.workflow?.canCancel ? (
                <button
                  type="button"
                  onClick={handleCancelApplication}
                  disabled={cancelMutation.isPending || isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Batalkan Pengajuan
                </button>
              ) : null}

              <Link
                to="/user/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Dashboard
              </Link>
            </div>
          </div>

          <div className={SECTION_CARD_CLASS}>
            <h2 className="text-lg font-semibold text-slate-950">Langkah Form</h2>
            <div className="mt-4 grid gap-2">
              {STEP_CONFIG.map((step, index) => {
                const isActive = step.code === activeStep;
                const isComplete =
                  index < currentStepIndex ||
                  (step.code === "review" && localCompleteness.isComplete);
                return (
                  <button
                    key={step.code}
                    type="button"
                    onClick={() => setActiveStep(step.code)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Langkah {index + 1}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{step.label}</p>
                      </div>
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <FileText className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{step.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
        <div className="space-y-5">
          {readOnlyStatus ? (
            <InfoNotice tone="info">
              {application.status === "submitted" || application.status === "under_review"
                ? "Pengajuan sedang ditinjau. Data dikunci sementara dan tidak bisa diubah sampai ada keputusan review berikutnya."
                : application.status === "approved"
                  ? workspaceHref
                    ? "Pengajuan sudah disetujui dan seller workspace untuk store ini sudah tersedia."
                    : "Pengajuan sudah disetujui. Sinkronisasi seller workspace membaca boundary backend yang sama dan bisa perlu refresh singkat."
                  : application.status === "rejected"
                    ? "Pengajuan ditutup dengan status ditolak. Anda dapat membuat pengajuan baru dari halaman ini."
                    : application.status === "cancelled"
                      ? "Pengajuan dibatalkan. Anda dapat membuat draft baru kapan saja."
                      : "Status saat ini tidak mengizinkan pengeditan draft."}
            </InfoNotice>
          ) : null}

          {renderCurrentStep()}

          <section className={SECTION_CARD_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Kontrol Draft</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Simpan draft kapan saja. Draft yang tersimpan tetap tersedia saat browser
                  di-refresh karena dibaca ulang dari backend `store_applications`.
                </p>
              </div>
              <StatusBadge
                label={application.statusMeta.label}
                tone={application.statusMeta.tone}
              />
            </div>

            {!localCompleteness.isComplete ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Field yang masih perlu dilengkapi sebelum submit:
                {" "}
                {localCompleteness.missingFields.map((field) => field.label).join(", ")}.
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Draft lokal sudah memenuhi field minimum untuk submit.
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              {editable ? (
                <button
                  type="button"
                  onClick={() => {
                    setFlash(null);
                    saveDraftMutation.mutate();
                  }}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saveDraftMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Draft
                </button>
              ) : null}

              {editable ? (
                <button
                  type="button"
                  onClick={() => {
                    setFlash(null);
                    submitMutation.mutate();
                  }}
                  disabled={isBusy || activeStep !== "review" || !localCompleteness.isComplete}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendHorizonal className="h-4 w-4" />
                  )}
                  {application.status === "revision_requested"
                    ? "Submit Ulang Pengajuan"
                    : "Submit Pengajuan"}
                </button>
              ) : null}

              {editable && currentStepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(STEP_CONFIG[currentStepIndex - 1].code)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Langkah Sebelumnya
                </button>
              ) : null}

              {editable && currentStepIndex < STEP_CONFIG.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(STEP_CONFIG[currentStepIndex + 1].code)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Langkah Berikutnya
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {editable && activeStep !== "review" ? (
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Tombol submit aktif di langkah Ringkasan setelah seluruh field minimum terisi.
              </p>
            ) : null}

            {application.status === "approved" && !workspaceHref ? (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                Status pengajuan sudah approved. Jika seller workspace belum muncul, sinkronkan
                ulang halaman ini agar akses seller terbaru dari backend terbaca.
              </div>
            ) : null}

            {application.status === "submitted" || application.status === "under_review" ? (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                Dashboard akan tetap menampilkan status peninjauan yang sama sampai backend review
                mengubah status pengajuan.
              </div>
            ) : null}
          </section>

          <section className={SECTION_CARD_CLASS}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Boundary Workflow</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Draft dan submission hanya menyimpan snapshot onboarding. Approval dapat
                  memprovision seller workspace boundary, tetapi store publik tetap tidak aktif
                  otomatis dan tetap mengikuti status store serta readiness backend.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SummaryItem label="Source of Truth" value={application.contract.sourceOfTruth} />
              <SummaryItem
                label="Transition Saat Ini"
                value={(application.workflow.nextAllowedTransitions || []).join(", ")}
              />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

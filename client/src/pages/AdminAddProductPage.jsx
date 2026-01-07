import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import axios from "axios";
// --- START: MODIFIKASI UNTUK POPUP ---
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// --- END: MODIFIKASI UNTUK POPUP ---

// Komponen kecil untuk ikon, agar JSX lebih bersih
const Icon = ({ path, className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d={path}
    />
  </svg>
);

const CheckmarkIcon = ({ isComplete }) => (
  <svg
    className={`w-4 h-4 mr-2 ${
      isComplete ? "text-green-500" : "text-gray-300"
    }`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    ></path>
  </svg>
);

/**
 * Komponen fungsional React tunggal untuk halaman "Tambah & Edit Produk".
 * @param {{ user: { name: string }, categories: { id: string, name: string }[] }} props
 */
const AddProductPage = ({ user, categories }) => {
  const router = useRouter();

  const { id: productId } = router.query;
  const isEditMode = !!productId;

  // STATE MANAGEMENT
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("info-produk");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    categoryId: categories.length > 0 ? categories[0].id : "",
    gtin: "",
    noGtin: false,
    imageRatio: "1:1",
    videoSource: "upload",
    youtubeLink: "",
    price: "",
    stock: "0",
    minPurchase: "1",
    maxPurchaseType: "unlimited",
    maxPurchaseValue: "",
    maxPurchasePeriod: "daily",
    weight: "",
    length: "",
    width: "",
    height: "",
    dangerousProduct: "false",
    preOrder: "false",
    preorderDays: "3",
    condition: "new",
    scheduledDisplay: "",
    parentSku: "",
    notes: "",
  });

  const [productImages, setProductImages] = useState([]);
  const [promoImage, setPromoImage] = useState(null);
  const [productVideo, setProductVideo] = useState(null);

  const [imagePreviews, setImagePreviews] = useState([]);
  const [promoImagePreview, setPromoImagePreview] = useState("");
  const [productVideoPreview, setProductVideoPreview] = useState("");
  const [youtubeVideoId, setYoutubeVideoId] = useState("");

  const [existingImageUrls, setExistingImageUrls] = useState([]);
  const [existingPromoImageUrl, setExistingPromoImageUrl] = useState("");
  const [existingVideoUrl, setExistingVideoUrl] = useState("");

  const [variationsEnabled, setVariationsEnabled] = useState(false);
  const [variationGroups, setVariationGroups] = useState([]);

  const [wholesaleTiers, setWholesaleTiers] = useState([]);

  const [isShippingModalOpen, setShippingModalOpen] = useState(false);
  const [manualShippingMethods, setManualShippingMethods] = useState([]);
  const [shippingModalData, setShippingModalData] = useState({
    serviceName: "",
    calcMethod: "flat",
    flatRateCost: "",
    weightRanges: [],
  });

  const [recommendations, setRecommendations] = useState({
    photo: false,
    video: false,
    name: false,
    desc: false,
  });

  const [tips, setTips] = useState({
    title: "Tips",
    content:
      "Arahkan kursor atau klik pada kolom isian untuk melihat tips dan penjelasan lebih lanjut.",
  });

  const [mainImagePreviewIndex, setMainImagePreviewIndex] = useState(0);

  // REFS for scrolling
  const photoSectionRef = useRef(null);
  const videoSectionRef = useRef(null);
  const nameInputRef = useRef(null);
  const descInputRef = useRef(null);

  // UTILITY FUNCTIONS
  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number || 0);
  };

  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp =
      /^.*(?:youtu.be\/|v\/|e\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  };

  // EVENT HANDLERS
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = value;

    // Convert specific fields to numbers
    if (
      [
        "price",
        "stock",
        "minPurchase",
        "maxPurchaseValue",
        "weight",
        "length",
        "width",
        "height",
        "preorderDays",
      ].includes(name)
    ) {
      val = value === "" ? "" : Number(value);
    } else if (type === "checkbox") {
      val = checked;
    }
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const newImages = [];
    const newPreviews = [];

    files.forEach((file) => {
      if (
        file.type.startsWith("image/") &&
        productImages.length + imagePreviews.length < 9
      ) {
        newImages.push(file);
        newPreviews.push(URL.createObjectURL(file));
      }
    });

    if (newImages.length > 0) {
      setProductImages((prev) => [...prev, ...newImages]);
      setImagePreviews((prev) => [...prev, ...newPreviews]);
    } else if (files.length > 0) {
      toast.warn(
        "Hanya file gambar yang diizinkan atau batas maksimum 9 gambar telah tercapai."
      );
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    const removedPreview = imagePreviews[indexToRemove];

    const existingIndex = existingImageUrls.indexOf(removedPreview);
    if (existingIndex > -1) {
      setExistingImageUrls((prev) =>
        prev.filter((url) => url !== removedPreview)
      );
    } else {
      const newImageIndex = indexToRemove - existingImageUrls.length;
      setProductImages((prev) => prev.filter((_, i) => i !== newImageIndex));
      URL.revokeObjectURL(removedPreview);
    }

    setImagePreviews((prev) => prev.filter((_, i) => i !== indexToRemove));
    if (mainImagePreviewIndex >= imagePreviews.length - 1) {
      setMainImagePreviewIndex(Math.max(0, imagePreviews.length - 2));
    }
  };

  const handlePromoImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      if (promoImagePreview && promoImagePreview.startsWith("blob:"))
        URL.revokeObjectURL(promoImagePreview);
      setPromoImage(file);
      setPromoImagePreview(URL.createObjectURL(file));
      setExistingPromoImageUrl("");
    } else if (file) {
      toast.warn("Hanya file gambar yang diizinkan untuk Foto Produk Promosi.");
    }
  };

  const handleRemovePromoImage = () => {
    if (promoImagePreview && promoImagePreview.startsWith("blob:"))
      URL.revokeObjectURL(promoImagePreview);
    setPromoImage(null);
    setPromoImagePreview("");
    setExistingPromoImageUrl("");
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === "video/mp4") {
        if (file.size <= 30 * 1024 * 1024) {
          // 30MB
          if (productVideoPreview && productVideoPreview.startsWith("blob:"))
            URL.revokeObjectURL(productVideoPreview);
          setProductVideo(file);
          setProductVideoPreview(URL.createObjectURL(file));
          setExistingVideoUrl("");
        } else {
          toast.error("Ukuran file video maksimal 30MB.");
        }
      } else {
        toast.error("Hanya format MP4 yang diizinkan untuk Video Produk.");
      }
    }
  };

  const handleRemoveVideo = () => {
    if (productVideoPreview && productVideoPreview.startsWith("blob:"))
      URL.revokeObjectURL(productVideoPreview);
    setProductVideo(null);
    setProductVideoPreview("");
    setExistingVideoUrl("");
  };

  const handleYoutubeLinkChange = (e) => {
    const url = e.target.value;
    setFormData((prev) => ({ ...prev, youtubeLink: url }));
    setYoutubeVideoId(getYouTubeId(url));
  };

  const handleToggleVariations = () => {
    const willBeEnabled = !variationsEnabled;
    setVariationsEnabled(willBeEnabled);
    if (willBeEnabled && variationGroups.length === 0) {
      setVariationGroups([
        { id: 1, name: "", options: [{ id: 1, value: "" }] },
      ]);
    }
  };
  const handleAddVariationGroup = () => {
    if (variationGroups.length < 2) {
      setVariationGroups((prev) => [
        ...prev,
        { id: Date.now(), name: "", options: [{ id: 1, value: "" }] },
      ]);
    }
  };
  const handleRemoveVariationGroup = (groupId) => {
    setVariationGroups((prev) => prev.filter((g) => g.id !== groupId));
  };
  const handleVariationChange = (groupId, field, value) => {
    setVariationGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, [field]: value } : g))
    );
  };
  const handleAddVariationOption = (groupId) => {
    setVariationGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            options: [...g.options, { id: Date.now(), value: "" }],
          };
        }
        return g;
      })
    );
  };
  const handleRemoveVariationOption = (groupId, optionId) => {
    setVariationGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return { ...g, options: g.options.filter((o) => o.id !== optionId) };
        }
        return g;
      })
    );
  };
  const handleVariationOptionChange = (groupId, optionId, value) => {
    setVariationGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            options: g.options.map((o) =>
              o.id === optionId ? { ...o, value } : o
            ),
          };
        }
        return g;
      })
    );
  };
  const handleAddWholesaleTier = () => {
    setWholesaleTiers((prev) => [
      ...prev,
      { id: Date.now(), minQuantity: "", price: "" },
    ]);
  };
  const handleRemoveWholesaleTier = (tierId) => {
    setWholesaleTiers((prev) => prev.filter((t) => t.id !== tierId));
  };
  const handleWholesaleTierChange = (tierId, field, value) => {
    setWholesaleTiers((prev) =>
      prev.map((t) => (t.id === tierId ? { ...t, [field]: value } : t))
    );
  };
  const handleShippingModalInputChange = (e) => {
    const { name, value } = e.target;
    setShippingModalData((prev) => ({ ...prev, [name]: value }));
  };
  const handleSaveShippingMethod = () => {
    if (!shippingModalData.serviceName) {
      toast.warn("Nama layanan kirim tidak boleh kosong.");
      return;
    }
    setManualShippingMethods((prev) => [
      ...prev,
      { ...shippingModalData, id: Date.now() },
    ]);
    setShippingModalOpen(false);
    setShippingModalData({
      serviceName: "",
      calcMethod: "flat",
      flatRateCost: "",
      weightRanges: [],
    });
  };
  const handleRemoveShippingMethod = (methodId) => {
    setManualShippingMethods((prev) => prev.filter((m) => m.id !== methodId));
  };

  const handleSubmit = async (status) => {
    const validationErrors = [];
    if (!formData.name.trim())
      validationErrors.push({ field: "Nama Produk", tab: "info-produk" });
    if (!formData.description.trim())
      validationErrors.push({ field: "Deskripsi", tab: "info-produk" });
    if (!promoImage && !isEditMode)
      validationErrors.push({
        field: "Foto Produk Promosi",
        tab: "info-produk",
      });
    if (!formData.price)
      validationErrors.push({ field: "Harga", tab: "info-penjualan" });
    if (!formData.stock)
      validationErrors.push({ field: "Stok", tab: "info-penjualan" });
    if (!formData.weight)
      validationErrors.push({ field: "Berat", tab: "pengiriman" });

    if (validationErrors.length > 0) {
      const firstError = validationErrors[0];
      setActiveTab(firstError.tab);
      const errorFields = validationErrors.map((err) => err.field).join(", ");
      toast.error(`Harap isi semua bidang yang wajib diisi: ${errorFields}`);
      return;
    }

    setIsLoading(true);

    const finalFormData = new FormData();

    for (const key in formData) {
      finalFormData.append(key, formData[key]);
    }

    finalFormData.append("status", status);

    productImages.forEach((file) => {
      finalFormData.append("productImages", file);
    });
    if (promoImage) {
      finalFormData.append("promoProductImage", promoImage);
    }
    if (productVideo) {
      finalFormData.append("productVideo", productVideo);
    }

    finalFormData.append(
      "variations",
      JSON.stringify(variationsEnabled ? variationGroups : [])
    );
    finalFormData.append("wholesale", JSON.stringify(wholesaleTiers));
    finalFormData.append(
      "manualShipping",
      JSON.stringify(manualShippingMethods)
    );

    if (isEditMode) {
      finalFormData.append(
        "existingImageUrls",
        JSON.stringify(existingImageUrls)
      );
      finalFormData.append("existingPromoImageUrl", existingPromoImageUrl);
      finalFormData.append("existingVideoUrl", existingVideoUrl);
    }

    try {
      let response;
      if (isEditMode) {
        response = await axios.put(
          `/api/v1/products/${productId}`,
          finalFormData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
      } else {
        response = await axios.post("/api/v1/products", finalFormData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      // --- START: MODIFIKASI UNTUK POPUP ---
      if (response.data.success) {
        const successMessage = `Produk berhasil ${
          isEditMode ? "diperbarui" : "ditambahkan"
        }!`;
        toast.success(successMessage);

        setTimeout(() => {
          router.push("/dashboard/admin/products");
        }, 2000); // Jeda 2 detik sebelum redirect
      } else {
        const errorMessage = `Gagal ${
          isEditMode ? "memperbarui" : "menyimpan"
        } produk: ${response.data.message || "Error tidak diketahui"}`;
        toast.error(errorMessage);
        setIsLoading(false); // Hentikan loading jika gagal tapi sukses secara teknis
      }
      // --- END: MODIFIKASI UNTUK POPUP ---
    } catch (error) {
      console.error("Error submitting form", error);
      const errorMessage =
        error.response?.data?.message ||
        "Terjadi kesalahan saat mengirim data.";
      toast.error(
        `Gagal ${
          isEditMode ? "memperbarui" : "menyimpan"
        } produk: ${errorMessage}`
      );
      setIsLoading(false); // Hentikan loading jika terjadi error
    }
    // Catatan: setIsLoading(false) dipindahkan ke dalam blok success/error
    // agar tidak dijalankan sebelum redirect timeout.
  };

  const handleBack = () => {
    if (window.confirm("Apakah Anda yakin ingin membuang perubahan?")) {
      router.push("/dashboard/admin/products");
    }
  };

  // EFFECTS
  useEffect(() => {
    if (isEditMode) {
      setIsLoading(true);
      axios
        .get(`/api/v1/products/${productId}`)
        .then((response) => {
          const product = response.data.data;

          setFormData({
            name: product.name || "",
            description: product.description || "",
            categoryId:
              product.categoryId ||
              (categories.length > 0 ? categories[0].id : ""),
            gtin: product.gtin || "",
            noGtin: product.noGtin || false,
            imageRatio: product.imageRatio || "1:1",
            videoSource: product.youtubeLink
              ? "youtube"
              : product.videoUrl
              ? "upload"
              : "upload",
            youtubeLink: product.youtubeLink || "",
            price: product.price || "",
            stock: product.stock || "0",
            minPurchase: product.minPurchase || "1",
            maxPurchaseType: product.maxPurchaseType || "unlimited",
            maxPurchaseValue: product.maxPurchaseValue || "",
            maxPurchasePeriod: product.maxPurchasePeriod || "daily",
            weight: product.weight || "",
            length: product.length || "",
            width: product.width || "",
            height: product.height || "",
            dangerousProduct: String(product.dangerousProduct || "false"),
            preOrder: String(product.preOrder || "false"),
            preorderDays: product.preorderDays || "3",
            condition: product.condition || "new",
            scheduledDisplay: product.scheduledDisplay
              ? new Date(product.scheduledDisplay).toISOString().slice(0, 16)
              : "",
            parentSku: product.parentSku || "",
            notes: product.notes || "",
          });

          const imageUrls =
            product.ProductGalleries?.map((img) => img.url) || [];
          setImagePreviews(imageUrls);
          setExistingImageUrls(imageUrls);

          if (product.promoImageUrl) {
            setPromoImagePreview(product.promoImageUrl);
            setExistingPromoImageUrl(product.promoImageUrl);
          }

          if (product.videoUrl) {
            setProductVideoPreview(product.videoUrl);
            setExistingVideoUrl(product.videoUrl);
          }

          if (product.youtubeLink) {
            setYoutubeVideoId(getYouTubeId(product.youtubeLink));
          }

          setWholesaleTiers(product.Wholesales || []);
          const variations = product.Variations || [];
          setVariationsEnabled(variations.length > 0);
          setVariationGroups(variations);
          setManualShippingMethods(product.ManualShippings || []);
        })
        .catch((error) => {
          console.error("Gagal mengambil data produk:", error);
          toast.error(
            "Gagal mengambil data produk. Anda akan diarahkan kembali."
          );
          setTimeout(() => router.push("/dashboard/admin/products"), 2000);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [productId, isEditMode, router]);

  useEffect(() => {
    const nameLen = formData.name.length;
    const descLen = formData.description.length;
    setRecommendations({
      photo: imagePreviews.length >= 3,
      video: productVideo !== null || !!youtubeVideoId || !!existingVideoUrl,
      name: nameLen >= 25 && nameLen <= 100,
      desc: descLen >= 100,
    });
  }, [
    formData.name,
    formData.description,
    imagePreviews,
    productVideo,
    youtubeVideoId,
    existingVideoUrl,
  ]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      if (promoImagePreview && promoImagePreview.startsWith("blob:"))
        URL.revokeObjectURL(promoImagePreview);
      if (productVideoPreview && productVideoPreview.startsWith("blob:"))
        URL.revokeObjectURL(productVideoPreview);
    };
  }, [imagePreviews, promoImagePreview, productVideoPreview]);

  // RENDER LOGIC
  const renderActiveTab = () => {
    switch (activeTab) {
      case "info-produk":
        return <InfoProdukTab />;
      case "info-penjualan":
        return <InfoPenjualanTab />;
      case "pengiriman":
        return <PengirimanTab />;
      case "lainnya":
        return <LainnyaTab />;
      default:
        return <InfoProdukTab />;
    }
  };

  const InfoProdukTab = () => (
    <section>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        1. Informasi Produk
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div ref={nameInputRef}>
          <label
            htmlFor="product-name"
            className="block text-sm font-medium text-gray-700"
          >
            Nama Produk <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="product-name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Nama Merek + Tipe Produk + Fitur Produk (Bahan, Warna, Ukuran, Variasi)"
            maxLength="255"
          />
        </div>
        <div ref={descInputRef}>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Deskripsi <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="4"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            maxLength="3000"
          ></textarea>
        </div>
        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700"
          >
            Kategori <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            name="categoryId"
            value={formData.categoryId}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="gtin"
            className="block text-sm font-medium text-gray-700"
          >
            GTIN (Global Trade Item Number)
            <span
              className="inline-block ml-1 cursor-pointer"
              title="Global Trade Item Number adalah identifikasi unik produk yang digunakan secara internasional."
            >
              <Icon
                path="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                className="h-4 w-4 text-gray-400 inline-block"
              />
            </span>
          </label>
          <input
            type="text"
            id="gtin"
            name="gtin"
            value={formData.gtin}
            onChange={handleInputChange}
            disabled={formData.noGtin}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="mt-2 flex items-center">
            <input
              type="checkbox"
              id="no-gtin"
              name="noGtin"
              checked={formData.noGtin}
              onChange={handleInputChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="no-gtin"
              className="ml-2 block text-sm text-gray-900"
            >
              Produk tanpa GTIN
            </label>
          </div>
        </div>
        <div ref={photoSectionRef} className="col-span-full">
          <label className="block text-sm font-medium text-gray-700">
            Foto Produk <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex items-center space-x-4">
            <input
              type="file"
              id="product-images"
              name="productImages"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
            <label
              htmlFor="product-images"
              className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Tambahkan Foto ({imagePreviews.length}/9)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="ratio-1-1"
                name="imageRatio"
                value="1:1"
                checked={formData.imageRatio === "1:1"}
                onChange={handleInputChange}
              />
              <label htmlFor="ratio-1-1">Foto 1:1</label>
              <input
                type="radio"
                id="ratio-3-4"
                name="imageRatio"
                value="3:4"
                checked={formData.imageRatio === "3:4"}
                onChange={handleInputChange}
              />
              <label htmlFor="ratio-3-4">Foto 3:4</label>
            </div>
            <button
              type="button"
              onClick={() =>
                alert("Contoh tampilan foto produk akan ditampilkan di sini.")
              }
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded"
            >
              Lihat Contoh
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {imagePreviews.map((preview, index) => (
              <div
                key={index}
                className="relative group cursor-pointer"
                onClick={() => setMainImagePreviewIndex(index)}
              >
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-32 object-cover rounded-md border border-gray-300"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(index);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Icon path="M6 18L18 6M6 6l12 12" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-full">
          <label className="block text-sm font-medium text-gray-700">
            Foto Produk Promosi <span className="text-red-500">*</span>
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Foto ini akan digunakan di halaman promosi, hasil pencarian, dan
            rekomendasi untuk menarik minat pembeli. Format foto yang diminta
            adalah rasio 1:1.
          </p>
          <div className="mt-1 flex items-center space-x-4">
            <input
              type="file"
              id="promo-product-image"
              name="promoProductImage"
              accept="image/*"
              onChange={handlePromoImageChange}
              className="hidden"
            />
            <label
              htmlFor="promo-product-image"
              className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Tambahkan Foto Promosi (1/1)
            </label>
            {promoImagePreview && (
              <div className="relative group">
                <img
                  src={promoImagePreview}
                  alt="Promo Preview"
                  className="w-24 h-24 object-cover rounded-md border border-gray-300"
                />
                <button
                  type="button"
                  onClick={handleRemovePromoImage}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Icon path="M6 18L18 6M6 6l12 12" className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div ref={videoSectionRef} className="col-span-full">
          <label className="block text-sm font-medium text-gray-700">
            Video Produk
          </label>
          <div className="mt-2 flex items-center space-x-4">
            <input
              type="radio"
              id="video-upload-option"
              name="videoSource"
              value="upload"
              checked={formData.videoSource === "upload"}
              onChange={handleInputChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="video-upload-option"
              className="text-sm text-gray-900"
            >
              Upload Video
            </label>
            <input
              type="radio"
              id="video-youtube-option"
              name="videoSource"
              value="youtube"
              checked={formData.videoSource === "youtube"}
              onChange={handleInputChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="video-youtube-option"
              className="text-sm text-gray-900"
            >
              Link YouTube
            </label>
          </div>

          {formData.videoSource === "upload" && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">
                Ukuran file maksimal 30MB, resolusi tidak melebihi 1280 x
                1280px, durasi video antara 10 hingga 60 detik, format file MP4.
              </p>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  id="product-video"
                  name="productVideo"
                  accept="video/mp4"
                  onChange={handleVideoChange}
                  className="hidden"
                />
                <label
                  htmlFor="product-video"
                  className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                >
                  Tambahkan Video
                </label>
                {productVideoPreview && (
                  <div className="relative group">
                    <video
                      src={productVideoPreview}
                      controls
                      className="w-48 h-auto rounded-md border border-gray-300"
                    ></video>
                    <button
                      type="button"
                      onClick={handleRemoveVideo}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon path="M6 18L18 6M6 6l12 12" className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {formData.videoSource === "youtube" && (
            <div className="mt-4">
              <label
                htmlFor="youtube-link"
                className="block text-sm font-medium text-gray-700"
              >
                Link Video YouTube
              </label>
              <input
                type="text"
                id="youtube-link"
                name="youtubeLink"
                value={formData.youtubeLink}
                onChange={handleYoutubeLinkChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Contoh: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              />
              {youtubeVideoId && (
                <div className="mt-2">
                  <iframe
                    width="320"
                    height="180"
                    src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-md"
                  ></iframe>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
  const InfoPenjualanTab = () => (
    <section>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        2. Informasi Penjualan
      </h2>
      <div className="mb-6 p-4 border rounded-md bg-gray-50">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Variasi
        </label>
        <button
          type="button"
          onClick={handleToggleVariations}
          className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"
        >
          {variationsEnabled ? "- Nonaktifkan Variasi" : "+ Aktifkan Variasi"}
        </button>

        {variationsEnabled && (
          <div className="mt-4">
            {variationGroups.map((group, groupIndex) => (
              <div
                key={group.id}
                className="variation-group border p-4 rounded-md bg-white mb-4"
              >
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveVariationGroup(group.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Icon path="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor={`variation-name-${group.id}`}
                      className="block text-sm font-medium text-gray-700"
                    >
                      Variasi {groupIndex + 1}
                    </label>
                    <input
                      type="text"
                      id={`variation-name-${group.id}`}
                      value={group.name}
                      onChange={(e) =>
                        handleVariationChange(group.id, "name", e.target.value)
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                      placeholder="Cth. Warna, dll"
                      maxLength="14"
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-gray-700">
                      Opsi
                    </label>
                    <div id={`variation-options-container-${group.id}`}>
                      {group.options.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center space-x-2 mb-2 variation-option-row"
                        >
                          <input
                            type="text"
                            value={option.value}
                            onChange={(e) =>
                              handleVariationOptionChange(
                                group.id,
                                option.id,
                                e.target.value
                              )
                            }
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                            placeholder="Cth. Merah, dll"
                            maxLength="20"
                          />
                          <button
                            type="button"
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Icon path="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-4 4 4 4-4V5h-2a1 1 0 100 2h2v2h-2a1 1 0 100 2h2v2h-2a1 1 0 100 2h2v2z" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveVariationOption(group.id, option.id)
                            }
                            className="text-red-400 hover:text-red-600"
                          >
                            <Icon path="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm-1 3a1 1 0 100 2h8a1 1 0 100-2H6z" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddVariationOption(group.id)}
                      className="add-variation-option-btn mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded text-sm"
                    >
                      + Tambah Opsi
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {variationGroups.length < 2 && (
              <button
                type="button"
                onClick={handleAddVariationGroup}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
              >
                + Tambah Variasi 2
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="price"
            className="block text-sm font-medium text-gray-700"
          >
            Harga <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">Rp</span>
            </div>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md"
              placeholder="Mohon masukkan"
              min="0"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="stock"
            className="block text-sm font-medium text-gray-700"
          >
            Stok <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="stock"
            name="stock"
            value={formData.stock}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
            min="0"
          />
        </div>
        <div>
          <label
            htmlFor="min-purchase"
            className="block text-sm font-medium text-gray-700"
          >
            Min. Jumlah Pembelian <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="min-purchase"
            name="minPurchase"
            value={formData.minPurchase}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
            min="1"
          />
          <p className="mt-1 text-sm text-gray-500">
            Jumlah minimum produk yang harus dibeli dalam satu transaksi.
          </p>
        </div>
        <div>
          <label
            htmlFor="max-purchase"
            className="block text-sm font-medium text-gray-700"
          >
            Maks. Jumlah Pembelian
          </label>
          <select
            id="max-purchase"
            name="maxPurchaseType"
            value={formData.maxPurchaseType}
            onChange={handleInputChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm"
          >
            <option value="unlimited">Tanpa Batas</option>
            <option value="per-order">Per Pesanan</option>
            <option value="per-period">Per Periode</option>
          </select>
          {formData.maxPurchaseType !== "unlimited" && (
            <div className="mt-2">
              <input
                type="number"
                id="max-purchase-value"
                name="maxPurchaseValue"
                value={formData.maxPurchaseValue}
                onChange={handleInputChange}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                placeholder="Masukkan jumlah"
              />
              {formData.maxPurchaseType === "per-period" && (
                <div className="mt-2">
                  <select
                    id="max-purchase-period"
                    name="maxPurchasePeriod"
                    value={formData.maxPurchasePeriod}
                    onChange={handleInputChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm"
                  >
                    <option value="daily">Per Hari</option>
                    <option value="weekly">Per Minggu</option>
                    <option value="monthly">Per Bulan</option>
                  </select>
                </div>
              )}
            </div>
          )}
          <p
            className={`mt-1 text-sm ${
              formData.maxPurchaseType === "unlimited"
                ? "text-red-500"
                : "text-gray-500"
            }`}
          >
            {formData.maxPurchaseType === "unlimited" &&
              "Maks. jumlah pembelian belum diatur."}
            {formData.maxPurchaseType === "per-order" &&
              "Atur Maks. jumlah pembelian setiap Pembeli per pesanan."}
            {formData.maxPurchaseType === "per-period" &&
              "Atur Maks. jumlah pembelian setiap Pembeli selama periode yang ditentukan, berapa pun jumlah pesanan yang dibuat."}
          </p>
        </div>
      </div>

      <div className="mb-6 p-4 border rounded-md bg-gray-50 mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Grosir
        </label>
        <button
          type="button"
          onClick={handleAddWholesaleTier}
          className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"
        >
          + Tambah Harga Grosir
        </button>
        <div className="mt-4 space-y-2">
          {wholesaleTiers.map((tier) => (
            <div
              key={tier.id}
              className="wholesale-tier border p-3 rounded-md bg-white flex items-center space-x-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Min. Kuantitas
                </label>
                <input
                  type="number"
                  value={tier.minQuantity}
                  onChange={(e) =>
                    handleWholesaleTierChange(
                      tier.id,
                      "minQuantity",
                      e.target.value
                    )
                  }
                  className="mt-1 block w-24 border border-gray-300 rounded-md shadow-sm py-1 px-2"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Harga Grosir
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Rp</span>
                  </div>
                  <input
                    type="number"
                    value={tier.price}
                    onChange={(e) =>
                      handleWholesaleTierChange(
                        tier.id,
                        "price",
                        e.target.value
                      )
                    }
                    className="block w-28 pl-9 pr-3 py-1 border border-gray-300 rounded-md"
                    placeholder="Harga"
                    min="0"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveWholesaleTier(tier.id)}
                className="text-red-400 hover:text-red-600 mt-5"
              >
                <Icon path="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm-1 3a1 1 0 100 2h8a1 1 0 100-2H6z" />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Harga grosir akan disembunyikan secara otomatis jika produk sedang
          dalam promosi tertentu (Kombo Hemat & Paket Diskon).
        </p>
      </div>
    </section>
  );
  const PengirimanTab = () => (
    <section>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        3. Pengiriman
      </h2>
      <div className="space-y-6">
        <div>
          <label
            htmlFor="weight"
            className="block text-sm font-medium text-gray-700"
          >
            Berat <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <input
              type="number"
              id="weight"
              name="weight"
              value={formData.weight}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-12"
              placeholder="0"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">gr</span>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Ukuran Paket
          </label>
          <div className="mt-1 grid grid-cols-3 gap-4">
            {["length", "width", "height"].map((dim) => (
              <div key={dim}>
                <label
                  htmlFor={dim}
                  className="block text-xs text-gray-500 capitalize"
                >
                  {dim}
                </label>
                <div className="relative rounded-md shadow-sm">
                  <input
                    type="number"
                    name={dim}
                    id={dim}
                    value={formData[dim]}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 pr-10"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">cm</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Produk Berbahaya <span className="text-red-500">*</span>
          </label>
          <div className="mt-2 space-y-2">
            <div className="flex items-center">
              <input
                id="dangerous-no"
                name="dangerousProduct"
                type="radio"
                value="false"
                checked={formData.dangerousProduct === "false"}
                onChange={handleInputChange}
                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
              />
              <label
                htmlFor="dangerous-no"
                className="ml-3 block text-sm font-medium text-gray-700"
              >
                Tidak
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="dangerous-yes"
                name="dangerousProduct"
                type="radio"
                value="true"
                checked={formData.dangerousProduct === "true"}
                onChange={handleInputChange}
                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
              />
              <label
                htmlFor="dangerous-yes"
                className="ml-3 block text-sm font-medium text-gray-700"
              >
                Mengandung baterai/magnet/cairan/bahan mudah terbakar
              </label>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-md bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ongkos Kirim
          </label>
          <p className="text-sm text-gray-500 mb-4">
            Atur jasa kirim yang Anda kelola sendiri. Biaya akan dihitung
            berdasarkan aturan yang Anda buat di bawah ini.
          </p>
          <div className="space-y-2 mb-4">
            {manualShippingMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-3 border rounded-md bg-white shadow-sm"
              >
                <div>
                  <span className="font-medium">{method.serviceName}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    (
                    {method.calcMethod === "flat"
                      ? "Tarif Tetap"
                      : "Berdasarkan Berat"}
                    )
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveShippingMethod(method.id)}
                  className="text-red-500 hover:text-red-700 font-medium"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShippingModalOpen(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"
          >
            + Tambah Jasa Kirim Manual
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Pre-Order
          </label>
          <div className="mt-2 space-y-2">
            <div className="flex items-center">
              <input
                id="preorder-no"
                name="preOrder"
                type="radio"
                value="false"
                checked={formData.preOrder === "false"}
                onChange={handleInputChange}
                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
              />
              <label
                htmlFor="preorder-no"
                className="ml-3 block text-sm font-medium text-gray-700"
              >
                Tidak
              </label>
            </div>
            <p className="text-xs text-gray-500 ml-7">
              Produk harus dikirim dalam 2 hari kerja.
            </p>
            <div className="flex items-center">
              <input
                id="preorder-yes"
                name="preOrder"
                type="radio"
                value="true"
                checked={formData.preOrder === "true"}
                onChange={handleInputChange}
                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
              />
              <label
                htmlFor="preorder-yes"
                className="ml-3 block text-sm font-medium text-gray-700"
              >
                Ya
              </label>
            </div>
            {formData.preOrder === "true" && (
              <div className="ml-7">
                <label
                  htmlFor="preorder-days"
                  className="block text-sm font-medium text-gray-700"
                >
                  Durasi Pre-order (hari)
                </label>
                <input
                  type="number"
                  name="preorderDays"
                  id="preorder-days"
                  value={formData.preorderDays}
                  onChange={handleInputChange}
                  className="mt-1 block w-full max-w-xs border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  min="3"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
  const LainnyaTab = () => (
    <section>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">4. Lainnya</h2>
      <div className="space-y-6">
        <div>
          <label
            htmlFor="condition"
            className="block text-sm font-medium text-gray-700"
          >
            Kondisi
          </label>
          <select
            id="condition"
            name="condition"
            value={formData.condition}
            onChange={handleInputChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm"
          >
            <option value="new">Baru</option>
            <option value="used">Bekas</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="scheduled-display"
            className="block text-sm font-medium text-gray-700"
          >
            Jadwal Ditampilkan
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </div>
            <input
              type="datetime-local"
              id="scheduled-display"
              name="scheduledDisplay"
              value={formData.scheduledDisplay}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pl-10"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="parent-sku"
            className="block text-sm font-medium text-gray-700"
          >
            SKU Induk
          </label>
          <input
            type="text"
            id="parent-sku"
            name="parentSku"
            value={formData.parentSku}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
            placeholder="Masukkan SKU utama/induk produk"
          />
        </div>
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700"
          >
            Catatan Tambahan
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows="3"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
          ></textarea>
        </div>
      </div>
    </section>
  );
  const ShippingModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Tambah Jasa Kirim Manual
        </h3>
        <div className="mt-2 space-y-4">
          <div>
            <label
              htmlFor="shipping-service-name"
              className="block text-sm font-medium text-gray-700"
            >
              Nama Layanan Kirim
            </label>
            <input
              type="text"
              id="shipping-service-name"
              name="serviceName"
              value={shippingModalData.serviceName}
              onChange={handleShippingModalInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
              placeholder="Contoh: Kurir Instan Toko"
            />
          </div>
          <div>
            <label
              htmlFor="shipping-calc-method"
              className="block text-sm font-medium text-gray-700"
            >
              Metode Kalkulasi Biaya
            </label>
            <select
              id="shipping-calc-method"
              name="calcMethod"
              value={shippingModalData.calcMethod}
              onChange={handleShippingModalInputChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md"
            >
              <option value="flat">Tarif Tetap (Flat Rate)</option>
              <option value="weight">Berdasarkan Berat</option>
            </select>
          </div>
          {shippingModalData.calcMethod === "flat" ? (
            <div>
              <label
                htmlFor="flat-rate-cost"
                className="block text-sm font-medium text-gray-700"
              >
                Biaya Ongkir
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">Rp</span>
                </div>
                <input
                  type="number"
                  id="flat-rate-cost"
                  name="flatRateCost"
                  value={shippingModalData.flatRateCost}
                  onChange={handleShippingModalInputChange}
                  className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md"
                  placeholder="0"
                />
              </div>
            </div>
          ) : (
            <div>... UI untuk berat belum diimplementasikan ...</div>
          )}
        </div>
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={() => setShippingModalOpen(false)}
            type="button"
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
          >
            Batal
          </button>
          <button
            onClick={handleSaveShippingMethod}
            type="button"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* --- START: MODIFIKASI UNTUK POPUP --- */}
      <ToastContainer
        position="top-right"
        autoClose={5000} // Notifikasi akan otomatis tertutup setelah 5 detik
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      {/* --- END: MODIFIKASI UNTUK POPUP --- */}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 sm:px-6 lg:px-8 py-8">
        {/* Left Sidebar */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="p-4 border rounded-lg shadow-sm bg-white">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Rekomendasi
            </h3>
            <ul className="space-y-2 text-sm">
              <li
                onClick={() =>
                  photoSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                className={`flex items-center cursor-pointer ${
                  recommendations.photo ? "text-green-500" : "text-gray-500"
                }`}
              >
                <CheckmarkIcon isComplete={recommendations.photo} /> Tambahkan
                minimal 3 foto produk
              </li>
              <li
                onClick={() =>
                  videoSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                className={`flex items-center cursor-pointer ${
                  recommendations.video ? "text-green-500" : "text-gray-500"
                }`}
              >
                <CheckmarkIcon isComplete={recommendations.video} /> Tambahkan
                video
              </li>
              <li
                onClick={() =>
                  nameInputRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                className={`flex items-center cursor-pointer ${
                  recommendations.name ? "text-green-500" : "text-gray-500"
                }`}
              >
                <CheckmarkIcon isComplete={recommendations.name} /> Nama produk
                (25-100 karakter)
              </li>
              <li
                onClick={() =>
                  descInputRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                className={`flex items-center cursor-pointer ${
                  recommendations.desc ? "text-green-500" : "text-gray-500"
                }`}
              >
                <CheckmarkIcon isComplete={recommendations.desc} /> Deskripsi
                (min. 100 karakter)
              </li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg bg-blue-50">
            <div className="flex items-center mb-2">
              <Icon
                path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                className="h-6 w-6 text-blue-500 mr-2"
              />
              <h3 className="text-lg font-semibold text-blue-800">
                {tips.title}
              </h3>
            </div>
            <p className="text-sm text-blue-700">{tips.content}</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            {isEditMode ? "Edit Produk" : "Tambahkan Produk Baru"}
          </h1>
          <div className="mb-6 border-b border-gray-200">
            <ul
              className="flex flex-wrap -mb-px text-sm font-medium text-center"
              role="tablist"
            >
              {[
                { id: "info-produk", label: "1. Informasi Produk" },
                { id: "info-penjualan", label: "2. Informasi Penjualan" },
                { id: "pengiriman", label: "3. Pengiriman" },
                { id: "lainnya", label: "4. Lainnya" },
              ].map((tab) => (
                <li key={tab.id} className="mr-2" role="presentation">
                  <button
                    onClick={() => handleTabClick(tab.id)}
                    className={`inline-block p-4 border-b-2 rounded-t-lg ${
                      activeTab === tab.id
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent hover:text-gray-600 hover:border-gray-300"
                    }`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            {renderActiveTab()}
            <div className="flex justify-end space-x-4 mt-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={isLoading}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => handleSubmit("archived")}
                disabled={isLoading}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                {isLoading
                  ? "Menyimpan..."
                  : isEditMode
                  ? "Update & Arsipkan"
                  : "Simpan & Arsipkan"}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit("published")}
                disabled={isLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                {isLoading
                  ? isEditMode
                    ? "Memperbarui..."
                    : "Menerbitkan..."
                  : isEditMode
                  ? "Update & Tampilkan"
                  : "Simpan & Tampilkan"}
              </button>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="lg:col-span-3">
          <div className="sticky top-8 p-4 border rounded-lg shadow-sm bg-white">
            <h3 className="text-lg font-semibold text-gray-800">Preview</h3>
            <p className="text-sm text-gray-500 mb-4">Rincian Produk</p>
            <div className="w-full h-48 bg-gray-200 rounded-md flex items-center justify-center mb-4">
              {imagePreviews.length > 0 ? (
                <div className="relative w-full h-full">
                  <img
                    src={imagePreviews[mainImagePreviewIndex]}
                    alt="Preview Produk"
                    className="w-full h-full object-cover rounded-md"
                  />
                  {imagePreviews.length > 1 && (
                    <div className="absolute inset-0 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() =>
                          setMainImagePreviewIndex(
                            (prev) =>
                              (prev - 1 + imagePreviews.length) %
                              imagePreviews.length
                          )
                        }
                        className="bg-black bg-opacity-50 text-white rounded-full p-2 m-2 hover:bg-opacity-75"
                      >
                        <Icon path="M15 19l-7-7 7-7" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMainImagePreviewIndex(
                            (prev) => (prev + 1) % imagePreviews.length
                          )
                        }
                        className="bg-black bg-opacity-50 text-white rounded-full p-2 m-2 hover:bg-opacity-75"
                      >
                        <Icon path="M9 5l7 7-7 7" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Icon
                  path="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  className="h-16 w-16 text-gray-400"
                />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-800 truncate">
                {formData.name || "Nama Produk"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {variationsEnabled
                  ? `${variationGroups.length} Variasi Tersedia`
                  : "0 Variasi Tersedia"}
              </p>
              <p className="text-xl font-bold text-red-600 mt-2">
                {formatRupiah(formData.price)}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center">
                <div>
                  <p className="font-semibold">{user.name}</p>
                </div>
                <button className="ml-auto border border-gray-300 rounded-md px-3 py-1 text-sm">
                  Kunjungi
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button className="col-span-1 bg-green-100 text-green-800 rounded-md p-2 text-sm flex items-center justify-center">
                <Icon path="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </button>
              <button className="col-span-1 bg-blue-100 text-blue-800 rounded-md p-2 text-sm flex items-center justify-center">
                <Icon path="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </button>
              <button className="col-span-1 bg-red-600 text-white rounded-md p-2 text-sm">
                Beli Sekarang
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
              Tampilan di aplikasi mungkin sedikit berbeda
            </p>
          </div>
        </aside>
      </div>
      {isShippingModalOpen && <ShippingModal />}
    </>
  );
};

export default AddProductPage;

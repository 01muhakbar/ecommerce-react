import { useState, useEffect } from "react";
import { useForm, Controller, type SubmitHandler, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { FiUploadCloud, FiX } from "react-icons/fi";
import { http, post } from "@/lib/http";
import { cn } from "@/utils/cn";

// 🔹 --- Helper Components (Normally in separate files) ---

// A basic TagInput component as it was not provided
const TagInput = ({
  value = [],
  onChange,
  name,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  name: string;
}) => {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
      }
      setInputValue("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-md border px-3 py-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 bg-slate-200 text-sm rounded-md px-2 py-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-slate-600 hover:text-slate-900"
            >
              <FiX size={14} />
            </button>
          </span>
        ))}
        <input
          id={name}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag and press Enter"
          className="flex-grow focus:outline-none bg-transparent"
        />
      </div>
    </div>
  );
};

// 🔹 --- Zod Schema for Validation ---
const schema = z
  .object({
    name: z.string().min(1, "Product name is required"),
    description: z.string().optional(),
    sku: z.string().min(1, "SKU is required"),
    barcode: z.string().optional(),
    categoryId: z.string().optional(),
    price: z.coerce.number().min(0, "Price must be positive"),
    salePrice: z.coerce.number().optional(),
    quantity: z.coerce.number().min(0, "Quantity must be at least 0"),
    slug: z.string().min(1, "Slug is required"),
    tags: z.array(z.string()).default([]),
  })
  .refine((data) => !data.salePrice || data.salePrice <= data.price, {
    message: "Sale price cannot be greater than the regular price",
    path: ["salePrice"],
  });

type FormValues = z.infer<typeof schema>;

// 🔹 --- Main AddProductForm Component ---
export default function AddProductForm() {
  const navigate = useNavigate();
  const [images, setImages] = useState<string[]>([]);
  const [hasVariants, setHasVariants] = useState(false);

  // API call to fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["adminCategories"],
    queryFn: () => http<any>("/admin/categories"),
  });
  const categories = categoriesData?.data?.categories || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      sku: "",
      price: 0,
      quantity: 0,
      slug: "",
      tags: [],
    },
  });
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  // Auto-generate slug from name
  const productName = watch("name");
  useEffect(() => {
    if (productName) {
      const slug = productName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 50);
      setValue("slug", slug, { shouldValidate: true });
    }
  }, [productName, setValue]);

  const onDrop = async (acceptedFiles: FileList | null) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    const formData = new FormData();
    Array.from(acceptedFiles).forEach((file) => {
      formData.append("files", file);
    });

    const toastId = toast.loading("Uploading images...");
    try {
      const res = await http<any>("/admin/products/upload", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });
      setImages((prev) => [...prev, ...res.data.urls]);
      toast.success("Images uploaded successfully!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Image upload failed.", { id: toastId });
    }
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const payload = { ...values, images };
    try {
      await post("/admin/products", payload);
      toast.success("Product created successfully!");
      navigate("/admin/catalog/products");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to create product.");
    }
  };

  const handlePriceChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "price" | "salePrice"
  ) => {
    const numValue = parseFloat(e.target.value.replace(/[^0-9]/g, ""));
    if (!isNaN(numValue)) {
      setValue(field, numValue, { shouldValidate: true });
    } else {
      setValue(field, 0, { shouldValidate: true });
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return "";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-4 sm:p-6">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Add Product</h1>
            <p className="text-sm text-slate-500">
              Add your product and necessary information from here
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Dummy Language Dropdown */}
            <select className="text-sm border-gray-300 rounded-md">
              <option>English</option>
              <option>Indonesia</option>
            </select>
            <button
              type="button"
              onClick={() => navigate("/admin/catalog/products")}
              className="text-slate-500 hover:text-slate-800"
            >
              <FiX size={24} />
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white border rounded-2xl p-6">
              <div className="border-b mb-6">
                <h3 className="text-lg font-medium pb-2">Basic Info</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium mb-1"
                  >
                    Product Title/Name
                  </label>
                  <input
                    id="name"
                    {...register("name")}
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium mb-1"
                  >
                    Product Description
                  </label>
                  <textarea
                    id="description"
                    {...register("description")}
                    rows={5}
                    className="w-full rounded-md border px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Images Card */}
            <div className="bg-white border rounded-2xl p-6">
              <h3 className="text-lg font-medium mb-4">Product Images</h3>
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer text-slate-600 hover:bg-slate-50"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <FiUploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-2">
                  Drag your images here, or{" "}
                  <span className="text-emerald-600 font-semibold">browse</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  (Only *.jpeg, *.png, *.webp images will be accepted)
                </p>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onDrop(e.target.files)}
                />
              </div>
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                  {images.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={url}
                        alt={`preview ${idx}`}
                        className="h-24 w-24 object-cover rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setImages(images.filter((i) => i !== url))
                        }
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Variants Switch */}
            <div className="bg-white border rounded-2xl p-4 flex items-center justify-between">
              <label htmlFor="has-variants" className="text-sm font-medium">
                Does this product have variants?
              </label>
              <button
                id="has-variants"
                type="button"
                onClick={() => setHasVariants(!hasVariants)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  hasVariants ? "bg-emerald-600" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    hasVariants ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {/* Pricing & Inventory Card */}
            <div className="bg-white border rounded-2xl p-6">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="price"
                      className="block text-sm font-medium mb-1"
                    >
                      Product Price
                    </label>
                    <input
                      id="price"
                      {...register("price", { valueAsNumber: true })}
                      onChange={(e) => handlePriceChange(e, "price")}
                      value={formatCurrency(watch("price"))}
                      className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {errors.price && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.price.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="salePrice"
                      className="block text-sm font-medium mb-1"
                    >
                      Sale Price
                    </label>
                    <input
                      id="salePrice"
                      {...register("salePrice", { valueAsNumber: true })}
                      onChange={(e) => handlePriceChange(e, "salePrice")}
                      value={formatCurrency(watch("salePrice"))}
                      className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {errors.salePrice && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.salePrice.message}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="quantity"
                    className="block text-sm font-medium mb-1"
                  >
                    Product Quantity
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    {...register("quantity", { valueAsNumber: true })}
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {errors.quantity && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.quantity.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Details Card */}
            <div className="bg-white border rounded-2xl p-6">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="sku"
                    className="block text-sm font-medium mb-1"
                  >
                    Product SKU
                  </label>
                  <input
                    id="sku"
                    {...register("sku")}
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {errors.sku && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.sku.message}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="barcode"
                    className="block text-sm font-medium mb-1"
                  >
                    Product Barcode
                  </label>
                  <input
                    id="barcode"
                    {...register("barcode")}
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="slug"
                    className="block text-sm font-medium mb-1"
                  >
                    Product Slug
                  </label>
                  <input
                    id="slug"
                    {...register("slug")}
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {errors.slug && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.slug.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Category & Tags Card */}
            <div className="bg-white border rounded-2xl p-6">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="categoryId"
                    className="block text-sm font-medium mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="categoryId"
                    {...register("categoryId")}
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="tags"
                    className="block text-sm font-medium mb-1"
                  >
                    Product Tags
                  </label>
                  <Controller
                    name="tags"
                    control={control}
                    render={({ field }) => <TagInput {...field} />}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Action Bar */}
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-lg border-t mt-6 py-4 px-6 flex justify-end gap-3 -mx-6 -mb-6">
          <button
            type="button"
            onClick={() => navigate("/admin/catalog/products")}
            className="px-4 py-2 border rounded-md hover:bg-slate-100 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 rounded-md bg-emerald-600 text-white font-semibold disabled:opacity-60 hover:bg-emerald-700"
          >
            {isSubmitting ? "Saving..." : "Add Product"}
          </button>
        </div>
      </form>
    </div>
  );
}

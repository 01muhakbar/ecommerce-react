import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import {
  createProductSchema,
  type CreateProductInput as CreateProductSchema,
} from "@ecommerce/schemas";
import api from "../api/axios";
import ImageUploader from "../components/ImageUploader";
import TagInput from "../components/TagInput";

const AdminAddProductPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<CreateProductSchema>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      tags: [],
      images: [],
    },
  });

  // Fetch categories
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["adminCategories"],
    queryFn: async () => {
      const { data } = await api.get("/admin/categories");
      return data.data;
    },
  });

  // Mutation for creating a product
  const { mutate: createProduct, isPending } = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post("/admin/products", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return data.data;
    },
    onSuccess: () => {
      toast.success("Produk berhasil ditambahkan!");
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      navigate("/admin/catalog/products");
    },
    onError: (
      error: AxiosError<{
        message?: string;
        errors?: { field: string; message: string }[];
      }>
    ) => {
      console.error("Error creating product:", error);
      // Coba ambil pesan error dari respons API, jika tidak ada, gunakan pesan default
      const errorMessage =
        error.response?.data?.message ||
        "Terjadi kesalahan saat membuat produk.";
      toast.error(errorMessage);

      // Jika ada error validasi dari server, tampilkan juga
      error.response?.data?.errors?.forEach((err) => {
        toast.warning(`[${err.field}]: ${err.message}`);
      });
    },
  });

  const onSubmit = (data: CreateProductSchema) => {
    const formData = new FormData();

    Object.keys(data).forEach((key) => {
      const value = data[key as keyof CreateProductSchema];
      if (key === "images") {
        if (value && Array.isArray(value)) {
          value.forEach((file: File) => {
            formData.append("images", file);
          });
        }
      } else if (key === "tags") {
        if (value && Array.isArray(value)) {
          formData.append("tags", JSON.stringify(value));
        }
      } else if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    createProduct(formData);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Add New Product</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Product Title */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Product Name
          </label>
          <input
            id="name"
            type="text"
            {...register("name")}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          {errors.name && (
            <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* Product Description */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Description
          </label>
          <textarea
            id="description"
            {...register("description")}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        {/* Product Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Product Images
          </label>
          <ImageUploader control={control} name="images" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SKU */}
          <div>
            <label
              htmlFor="sku"
              className="block text-sm font-medium text-gray-700"
            >
              SKU
            </label>
            <input
              id="sku"
              type="text"
              {...register("sku")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          {/* Barcode */}
          <div>
            <label
              htmlFor="barcode"
              className="block text-sm font-medium text-gray-700"
            >
              Barcode
            </label>
            <input
              id="barcode"
              type="text"
              {...register("barcode")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label
            htmlFor="categoryId"
            className="block text-sm font-medium text-gray-700"
          >
            Category
          </label>
          <select
            id="categoryId"
            {...register("categoryId")}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            disabled={isLoadingCategories}
          >
            <option value="">Select a category</option>
            {categories?.map((category: any) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="mt-2 text-sm text-red-600">
              {errors.categoryId.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Price */}
          <div>
            <label
              htmlFor="price"
              className="block text-sm font-medium text-gray-700"
            >
              Price
            </label>
            <input
              id="price"
              type="number"
              {...register("price")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.price && (
              <p className="mt-2 text-sm text-red-600">
                {errors.price.message}
              </p>
            )}
          </div>
          {/* Sale Price */}
          <div>
            <label
              htmlFor="salePrice"
              className="block text-sm font-medium text-gray-700"
            >
              Sale Price
            </label>
            <input
              id="salePrice"
              type="number"
              {...register("salePrice")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          {/* Quantity */}
          <div>
            <label
              htmlFor="quantity"
              className="block text-sm font-medium text-gray-700"
            >
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              {...register("quantity")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.quantity && (
              <p className="mt-2 text-sm text-red-600">
                {errors.quantity.message}
              </p>
            )}
          </div>
        </div>

        {/* Product Slug */}
        <div>
          <label
            htmlFor="slug"
            className="block text-sm font-medium text-gray-700"
          >
            Slug
          </label>
          <input
            id="slug"
            type="text"
            {...register("slug")}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          {errors.slug && (
            <p className="mt-2 text-sm text-red-600">{errors.slug.message}</p>
          )}
        </div>

        {/* Product Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Tags
          </label>
          <TagInput control={control} name="tags" />
        </div>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => navigate("/admin/catalog/products")}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {isPending ? "Adding..." : "Add Product"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminAddProductPage;

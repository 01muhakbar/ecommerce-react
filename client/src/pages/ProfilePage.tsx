import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProfileSchema } from "@ecommerce/schemas";
import api from "../api/axios";

// Define the type from the schema
type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Fungsi untuk mengambil data profil pengguna
const fetchUserProfile = async () => {
  const { data } = await api.get("/users/me");
  return data; // Asumsi data user ada di root response
};

// Fungsi untuk memperbarui profil pengguna
const updateUserProfile = async (profileData: UpdateProfileInput) => {
  const { data } = await api.patch("/users/me", profileData);
  return data;
};

const ProfilePage: React.FC = () => {
  const queryClient = useQueryClient();

  // 1. Mengambil data pengguna saat ini
  const {
    data: user,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["me"], // Menggunakan query key yang sama dengan di App.tsx
    queryFn: fetchUserProfile,
  });

  // 2. Setup mutasi untuk memperbarui profil
  const { mutate, isPending: isUpdating } = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      alert("Profil berhasil diperbarui!");
      // Membatalkan dan mengambil ulang query 'me' agar data di halaman ini fresh
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err: any) => {
      alert(
        `Gagal memperbarui profil: ${
          err.response?.data?.message || err.message
        }`
      );
    },
  });

  // 3. Setup form dengan react-hook-form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: "",
    },
  });

  // Mengisi form dengan data pengguna setelah data berhasil diambil
  useEffect(() => {
    if (user) {
      reset({ name: user.name });
    }
  }, [user, reset]);

  const onSubmit = (data: UpdateProfileInput) => {
    mutate(data);
  };
  if (isLoading)
    return <div className="text-center p-8">Loading profile...</div>;
  if (isError)
    return (
      <div className="text-center p-8 text-red-500">Error: {error.message}</div>
    );

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Profil Saya</h1>
      <div className="bg-white p-8 rounded-lg shadow-md max-w-lg mx-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label
              htmlFor="name"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Nama:
            </label>
            <input
              type="text"
              id="name"
              {...register("name")}
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                errors.name ? "border-red-500" : ""
              }`}
              disabled={isUpdating}
            />
            {errors.name && (
              <p className="text-red-500 text-xs italic mt-2">
                {String(errors.name?.message || "")}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email:
            </label>
            <input
              type="email"
              value={user?.email || ""}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 bg-gray-200 leading-tight focus:outline-none focus:shadow-outline"
              disabled // Email tidak bisa diubah
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-blue-300"
              disabled={isUpdating}
            >
              {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;

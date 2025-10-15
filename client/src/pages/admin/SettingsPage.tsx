import {
  useSettings,
  useUpdateSettings,
} from "@/features/settings/useSettings";
import { useForm } from "react-hook-form";
import { useEffect } from "react";

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  const onSubmit = (data: any) => {
    updateSettings.mutate(data);
  };

  if (isLoading) return <div className="p-4">Loading settings…</div>;

  return (
    <div className="p-4 max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">Store Settings</h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 bg-white p-6 rounded-xl border"
      >
        <div>
          <label
            htmlFor="storeName"
            className="block text-sm font-medium text-gray-700"
          >
            Store Name
          </label>
          <input
            {...register("storeName")}
            id="storeName"
            className="mt-1 block w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label
            htmlFor="storeEmail"
            className="block text-sm font-medium text-gray-700"
          >
            Contact Email
          </label>
          <input
            {...register("storeEmail")}
            id="storeEmail"
            className="mt-1 block w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label
            htmlFor="storePhone"
            className="block text-sm font-medium text-gray-700"
          >
            Phone Number
          </label>
          <input
            {...register("storePhone")}
            id="storePhone"
            className="mt-1 block w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label
            htmlFor="storeAddress"
            className="block text-sm font-medium text-gray-700"
          >
            Address
          </label>
          <textarea
            {...register("storeAddress")}
            id="storeAddress"
            rows={3}
            className="mt-1 block w-full p-2 border rounded-md"
          ></textarea>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateSettings.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md disabled:opacity-50"
          >
            {updateSettings.isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

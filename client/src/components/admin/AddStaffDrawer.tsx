import React, { useEffect, useMemo, useState } from "react";
import Drawer from "../ui/Drawer";
import ImageDropzone from "../ui/ImageDropzone";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/axios";

const roles = ["Super Admin", "Admin", "Manager", "Staff"] as const;

const ALL_ROUTES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "catalog", label: "Catalog" },
  { key: "customers", label: "Customers" },
  { key: "orders", label: "Orders" },
  { key: "our-staff", label: "Our Staff" },
  { key: "settings", label: "Settings" },
  { key: "international", label: "International" },
  { key: "online-store", label: "Online Store" },
  { key: "pages", label: "Pages" },
];

const baseSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email(),
  contactNumber: z.string().min(7, "Invalid phone").optional().or(z.literal("")),
  joiningDate: z.string().min(1, "Joining Date is required"),
  role: z.enum(roles),
  routes: z.array(z.string()).min(1, "Select at least one route"),
  image: z
    .instanceof(File)
    .refine(f => ["image/jpeg", "image/png", "image/webp"].includes(f.type), "Invalid image type")
    .optional(),
});

const createSchema = baseSchema.extend({
  password: z.string().min(6, "Min 6 characters"),
});

const editSchema = baseSchema.extend({
  password: z.string().min(6, "Min 6 characters").optional().or(z.literal("")),
});


type FormValues = z.infer<typeof createSchema>;
type Props = { open: boolean; onClose: () => void; editMode?: boolean; initialValues?: Partial<FormValues> & { avatarUrl?: string }; staffId?: number; };

export default function AddStaffDrawer({ open, onClose, editMode, initialValues, staffId }: Props) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<string | null>(null);

  const schema = editMode ? editSchema : createSchema;

  const { control, register, handleSubmit, watch, formState: { errors, isSubmitting }, reset } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { routes: [], role: "Staff", joiningDate: new Date().toISOString().slice(0,10), ...initialValues },
    });

  useEffect(() => {
    if (open) {
        const defaultVals = { routes: [], role: "Staff", joiningDate: new Date().toISOString().slice(0,10), ...initialValues };
        reset(defaultVals);
        if (editMode && initialValues?.avatarUrl) {
            setPreview(initialValues.avatarUrl);
        } else {
            setPreview(null);
        }
    }
  }, [open, initialValues, reset, editMode]);

  const { mutateAsync } = useMutation({
    mutationFn: async (data: FormValues) => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (k === "routes" && Array.isArray(v)) {
          v.forEach(r => fd.append("routes[]", r));
        } else if (k === "image" && v instanceof File) {
          fd.append("image", v);
        } else if (v !== undefined && v !== null && !(v instanceof File)) {
          if (editMode && k === 'password' && !v) return; // Don't append empty password in edit mode
          fd.append(k, String(v));
        }
      });

      if (editMode && staffId) {
        const res = await api.patch(`/admin/staff/${staffId}`, fd, { headers: { "Content-Type":"multipart/form-data" }});
        return res.data;
      } else {
        const res = await api.post("/admin/staff", fd, { headers: { "Content-Type":"multipart/form-data" }});
        return res.data;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:["staff"] }); onClose(); reset(); }
  });

  const image = watch("image");
  useMemo(() => {
    if (image instanceof File) {
      const url = URL.createObjectURL(image);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } 
  }, [image]);

  const onSubmit = (v: FormValues) => mutateAsync(v);

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{editMode ? "Edit Staff" : "Add Staff"}</h2>
            <p className="text-sm text-gray-500">{editMode ? "Edit your staff necessary information from here" : "Add your staff necessary information from here"}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label className="block font-medium mb-2">Staff Image</label>
            <Controller
              control={control}
              name="image"
              render={({ field }) => (
                <ImageDropzone onFile={field.onChange} previewUrl={preview} />
              )}
            />
            <p className="text-xs text-gray-500 mt-2">(Only *.jpeg, *.webp and *.png images will be accepted)</p>
            {errors.image && <p className="text-red-600 text-sm mt-1">{errors.image.message as string}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block mb-1 font-medium">Name</label>
              <input {...register("name")} className="w-full border rounded-lg px-3 py-2" placeholder="Staff name"/>
              {errors.name && <p className="text-red-600 text-sm">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block mb-1 font-medium">Email</label>
              <input type="email" {...register("email")} className="w-full border rounded-lg px-3 py-2" placeholder="Email"/>
              {errors.email && <p className="text-red-600 text-sm">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block mb-1 font-medium">Password</label>
              <input type="password" {...register("password")} className="w-full border rounded-lg px-3 py-2" placeholder={editMode ? "Leave blank to keep unchanged" : "Password"}/>
              {errors.password && <p className="text-red-600 text-sm">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block mb-1 font-medium">Contact Number</label>
              <input {...register("contactNumber")} className="w-full border rounded-lg px-3 py-2" placeholder="Phone number"/>
              {errors.contactNumber && <p className="text-red-600 text-sm">{errors.contactNumber.message}</p>}
            </div>

            <div>
              <label className="block mb-1 font-medium">Joining Date</label>
              <input type="date" {...register("joiningDate")} className="w-full border rounded-lg px-3 py-2"/>
              {errors.joiningDate && <p className="text-red-600 text-sm">{errors.joiningDate.message}</p>}
            </div>

            <div>
              <label className="block mb-1 font-medium">Staff Role</label>
              <select {...register("role")} className="w-full border rounded-lg px-3 py-2">
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.role && <p className="text-red-600 text-sm">{errors.role.message}</p>}
            </div>

            <div>
              <label className="block mb-1 font-medium">Select Routes to given Access</label>
              <div className="border rounded-lg p-3 grid grid-cols-2 gap-2 max-h-44 overflow-auto">
                {ALL_ROUTES.map(rt => (
                  <label key={rt.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" value={rt.key} {...register("routes")} />
                    <span>{rt.label}</span>
                  </label>
                ))}
              </div>
              {errors.routes && <p className="text-red-600 text-sm">{errors.routes.message as string}</p>}
            </div>
          </div>

          <div className="sticky bottom-0 bg-white pt-4">
            <div className="flex justify-between gap-3 border-t pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border">Cancel</button>
              <button disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-emerald-600 text-white">
                {isSubmitting ? "Saving..." : (editMode ? "Save Changes" : "Add Staff")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Drawer>
  );
}
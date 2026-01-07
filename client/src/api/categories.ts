import { api } from "@/api/axios";

export type Category = {
  id: number;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  published: boolean;
  parent_id?: number | null;
  parent?: Pick<Category, "id" | "name" | "code"> | null;
};

export async function listCategories(params: {
  q?: string;
  page?: number;
  pageSize?: number;
  parentsOnly?: boolean;
  published?: boolean;
  sort?: string;
}) {
  const { data } = await api.get("/admin/categories", { params });
  return data as { data: Category[]; page: number; pageSize: number; total: number };
}
export async function getCategory(id: number) {
  return (await api.get(`/admin/categories/${id}`)).data;
}
export async function createCategory(body: Partial<Category>) {
  return (await api.post(`/admin/categories`, body)).data;
}
export async function updateCategory(id: number, body: Partial<Category>) {
  return (await api.put(`/admin/categories/${id}`, body)).data;
}
export async function deleteCategory(id: number) {
  return (await api.delete(`/admin/categories/${id}`)).data;
}
export async function bulkCategories(body: { action: "delete" | "publish" | "unpublish"; ids: number[] }) {
  return (await api.post(`/admin/categories/bulk`, body)).data;
}
export async function setPublish(id: number, published: boolean) {
  return (await api.patch(`/admin/categories/${id}/publish`, { published })).data;
}
export function exportCategoriesUrl() {
  return `/api/admin/categories/export`;
}
export async function importCategoriesCSV(file: File) {
  const form = new FormData();
  form.append("file", file);
  return (
    await api.post(`/admin/categories/import`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  ).data;
}


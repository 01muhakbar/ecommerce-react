import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { formatIDR } from "@/utils/currency";

export default function ProductDetailsPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () =>
      (await axios.get(`/api/admin/products/${id}`, { withCredentials: true }))
        .data,
  });

  if (isLoading) return <div className="p-6">Memuat…</div>;
  if (!data) return <div className="p-6">Produk tidak ditemukan.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Product Details</h1>
      <div className="rounded-xl border bg-white p-4 grid sm:grid-cols-2 gap-4">
        {/* Media gallery */}
        <div className="sm:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="md:col-span-2">
            {data.promoImagePath ? (
              <img
                src={data.promoImagePath}
                alt={data.name}
                className="w-full aspect-[4/3] object-cover rounded-lg border"
              />
            ) : (
              <div className="w-full aspect-[4/3] rounded-lg border bg-slate-100" />
            )}
          </div>
          <div className="flex md:block gap-2 md:space-y-2 overflow-x-auto">
            {(data.imagePaths || []).map((url: string, idx: number) => (
              <img
                key={idx}
                src={url}
                alt={`${data.name} ${idx + 1}`}
                className="h-20 w-20 rounded object-cover border"
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-slate-500 text-sm">Name</div>
          <div className="font-medium">{data.name}</div>
        </div>
        <div>
          <div className="text-slate-500 text-sm">Category</div>
          <div className="font-medium">{data.Category?.name}</div>
        </div>
        <div>
          <div className="text-slate-500 text-sm">Price</div>
          <div className="font-medium">{formatIDR(data.price)}</div>
        </div>
        <div>
          <div className="text-slate-500 text-sm">Sale Price</div>
          <div className="font-medium">{formatIDR(data.salePrice)}</div>
        </div>
        <div>
          <div className="text-slate-500 text-sm">Stock</div>
          <div className="font-medium">{data.stock}</div>
        </div>
        <div>
          <div className="text-slate-500 text-sm">Status</div>
          <div className="font-medium">
            {data.status === "selling" ? "Selling" : "Sold Out"}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-sm">Published</div>
          <div className="font-medium">{data.published ? "Yes" : "No"}</div>
        </div>
      </div>
    </div>
  );
}


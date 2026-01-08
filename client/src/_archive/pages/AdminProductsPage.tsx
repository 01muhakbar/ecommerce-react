import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import http from "@/lib/http";

export default function ProductsPage() {
  const navigate = useNavigate(); // Initialize useNavigate
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await http<{ items: any[]; total: number }>(
          "/admin/catalog/products"
        );
        if (mounted) setItems(data.items || []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load products");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <button
          className="rounded-md px-3 py-2 border"
          onClick={() => navigate("/admin/catalog/products/new")}
        >
          + Add Product
        </button>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      <ul className="divide-y border rounded-md">
        {items.map((it, idx) => (
          <li key={it.id ?? idx} className="p-3">
            <div className="font-medium">
              {it.name ?? `Product #${it.id ?? idx}`}
            </div>
          </li>
        ))}
        {!loading && !error && items.length === 0 && (
          <li className="p-3 text-gray-500">No products</li>
        )}
      </ul>
    </div>
  );
}

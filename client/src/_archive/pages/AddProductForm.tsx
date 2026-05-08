// client/src/pages/admin/products/AddProductForm.tsx
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import http from "@/lib/http";
// import { useToast } from "@/components/ui/use-toast"; // aktifkan jika Anda pakai shadcn

export default function AddProductForm() {
  const navigate = useNavigate();
  // const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [status, setStatus] = useState<"active" | "inactive">("active");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      await http("/admin/catalog/products", {
        method: "POST",
        body: JSON.stringify({ name, sku: sku || null, price, stock, status }),
      });
      // toast({ title: "Success", description: "Product created." });
      navigate("/admin/catalog/products");
    } catch (err: any) {
      // toast({ title: "Failed", description: err?.message ?? "Create failed" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function onCancel() {
    navigate("/admin/catalog/products");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm">Name</label>
        <input
          className="border rounded-md px-3 py-2 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm">SKU</label>
          <input
            className="border rounded-md px-3 py-2 w-full"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Optional SKU"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Status</label>
          <select
            className="border rounded-md px-3 py-2 w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm">Price</label>
          <input
            type="number"
            step="0.01"
            className="border rounded-md px-3 py-2 w-full"
            value={price}
            onChange={(e) => setPrice(parseFloat(e.target.value || "0"))}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Stock</label>
          <input
            type="number"
            className="border rounded-md px-3 py-2 w-full"
            value={stock}
            onChange={(e) => setStock(parseInt(e.target.value || "0", 10))}
            required
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="border px-3 py-2 rounded-md"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="border px-3 py-2 rounded-md"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

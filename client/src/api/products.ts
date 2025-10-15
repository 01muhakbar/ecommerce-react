// client/src/api/products.ts
// Client-only stub. Real DB ops happen on the server.

export type ProductRow = {
  id: number;
  name: string;
  sku?: string;
  price: number;
  quantity?: number;
  status?: "active" | "inactive";
  published?: boolean;
};

export interface ProductsApiShape {
  list(): Promise<ProductRow[]>;
  create(payload: Partial<ProductRow>): Promise<{ id: number }>;
  update(id: number, payload: Partial<ProductRow>): Promise<{ id: number }>;
  remove(id: number): Promise<void>;
}

// Minimal, build-safe stub:
export const ProductsApi: ProductsApiShape = {
  async list() {
    return [];
  },
  async create(_payload) {
    return { id: 0 };
  },
  async update(id, _payload) {
    return { id };
  },
  async remove(_id) {
    return;
  },
};

export default ProductsApi;

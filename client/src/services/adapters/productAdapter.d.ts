export function logProductNormalization(scope: string, before: unknown, after: unknown): void;
export function normalizeProduct<T = Record<string, unknown>>(raw: T): T & {
  id: unknown;
  name: string;
  title: string;
  price: number;
  salePrice: unknown;
  attributes: unknown;
  vendor: unknown;
  seller: unknown;
  stock: number;
  quantity: unknown;
  image: string | null;
  thumbnail: unknown;
  productReadModel: {
    id: unknown;
    name: string;
    price: number;
    attributes: unknown;
    vendor: unknown;
    stock: number;
    image: string | null;
  };
} | null;

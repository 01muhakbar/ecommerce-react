export type UserSession = {
  user: {
    id?: string | number;
    name?: string;
    email?: string;
    role?: string;
  };
  role?: string;
};

export type Product = {
  id: string | number;
  name?: string;
  title?: string;
  price?: number;
  stock?: number;
  images?: string[];
  category?: string;
  description?: string;
};

export type Category = {
  id: string | number;
  name?: string;
  parentId?: string | number | null;
};

export type Order = {
  id: string | number;
  status?: string;
  total?: number;
  createdAt?: string;
  customerName?: string;
  customerEmail?: string;
  items?: Array<{
    id?: string | number;
    name?: string;
    quantity?: number;
    price?: number;
  }>;
};

import { api } from "./axios";

export type ReviewPayload = {
  rating: number;
  comment?: string;
  images?: string[];
};

export type ReviewResponse = {
  id: number;
  userId: number;
  productId: number;
  rating: number;
  comment?: string | null;
  images?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
  product?: {
    id: number;
    name: string;
    slug?: string | null;
    imageUrl?: string | null;
  } | null;
};

export type NeedReviewItem = {
  productId: number;
  orderId?: number | null;
  orderRef?: string | null;
  orderedAt?: string | null;
  slug?: string | null;
  name: string;
  image?: string | null;
  imageUrl?: string | null;
};

type ReviewsListResponse = {
  items?: ReviewResponse[];
  meta?: {
    totalItems?: number;
  };
};

type NeedReviewListResponse = {
  items?: NeedReviewItem[];
  meta?: {
    totalItems?: number;
  };
};

export const fetchMyReviews = async () => {
  const { data } = await api.get<ReviewsListResponse>("/store/my/reviews");
  const items = Array.isArray(data?.items) ? data.items : [];
  const totalItems = Number(data?.meta?.totalItems ?? items.length);
  return {
    items,
    meta: {
      totalItems: Number.isFinite(totalItems) ? totalItems : items.length,
    },
  };
};

export const fetchMyReviewNeeds = async () => {
  const { data } = await api.get<NeedReviewListResponse>("/store/my/reviews/need");
  const items = Array.isArray(data?.items) ? data.items : [];
  const totalItems = Number(data?.meta?.totalItems ?? items.length);
  return {
    items,
    meta: {
      totalItems: Number.isFinite(totalItems) ? totalItems : items.length,
    },
  };
};

export const createReview = async (payload: {
  productId: number;
  rating: number;
  comment?: string;
  images?: string[];
}) => {
  const { data } = await api.post<{ data: ReviewResponse }>(
    "/store/reviews",
    payload
  );
  return data;
};

export const updateReview = async (
  id: number,
  payload: ReviewPayload
) => {
  const { data } = await api.patch<{ data: ReviewResponse }>(
    `/store/reviews/${id}`,
    payload
  );
  return data;
};

export const upsertReviewByProduct = async (
  productId: number,
  payload: ReviewPayload
) => {
  const { data } = await api.put<{ data: ReviewResponse }>(
    `/store/reviews/product/${productId}`,
    payload
  );
  return data;
};

export const uploadReviewImage = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ data?: { url?: string } }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = data?.data?.url;
  if (!url) {
    throw new Error("Upload succeeded without URL.");
  }
  return url;
};

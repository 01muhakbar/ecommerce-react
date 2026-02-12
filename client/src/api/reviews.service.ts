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

export const fetchMyReviews = async () => {
  const { data } = await api.get<{ data: ReviewResponse[] }>("/store/my/reviews");
  return data;
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

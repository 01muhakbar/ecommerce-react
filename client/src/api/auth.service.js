import { httpPost } from "./httpClient.js";

export async function login(payload) {
  return httpPost("/auth/login", payload);
}

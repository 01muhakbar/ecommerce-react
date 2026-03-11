export function getSellerRequestErrorMessage(
  error,
  {
    invalidStoreMessage = "Seller workspace needs a valid store id in the URL.",
    notFoundMessage = "Store not found.",
    forbiddenMessage = "This account cannot access the selected seller workspace.",
    permissionMessage = "Your current seller access does not include this seller module.",
    fallbackMessage = "Seller workspace request failed.",
  } = {}
) {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.response?.data?.code || "").trim();
  const apiMessage = String(error?.response?.data?.message || "").trim();

  if (status === 400 && code === "INVALID_STORE_ID") {
    return invalidStoreMessage;
  }

  if (status === 403 && code === "SELLER_FORBIDDEN") {
    return forbiddenMessage;
  }

  if (status === 403 && code === "SELLER_PERMISSION_DENIED") {
    return permissionMessage;
  }

  if (status === 404 && code === "STORE_NOT_FOUND") {
    return notFoundMessage;
  }

  return apiMessage || error?.message || fallbackMessage;
}

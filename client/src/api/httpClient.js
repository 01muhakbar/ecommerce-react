const BASE_URL = import.meta.env.VITE_API_BASE_URL;
let authToken = "";
let unauthorizedHandler = null;

export function setAuthToken(token) {
  authToken = token || "";
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function request(method, endpoint, body) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof unauthorizedHandler === "function") {
      unauthorizedHandler();
    }
    if (response.status === 403) {
      window.alert("No permission.");
    } else if (response.status >= 500) {
      window.alert("Server error.");
    }
    throw new Error("Network response was not ok");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function httpGet(endpoint) {
  return request("GET", endpoint);
}

export async function httpPost(endpoint, body) {
  return request("POST", endpoint, body);
}

export async function httpPut(endpoint, body) {
  return request("PUT", endpoint, body);
}

export async function httpDelete(endpoint) {
  return request("DELETE", endpoint);
}

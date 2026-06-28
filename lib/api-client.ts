const apiBaseUrl = process.env.API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("API_BASE_URL is not configured");
}

async function apiRequest<TResponse>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API ${method} ${path} failed with ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>("GET", path);
}

export async function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  return apiRequest<TResponse>("POST", path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function apiPatch<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  return apiRequest<TResponse>("PATCH", path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

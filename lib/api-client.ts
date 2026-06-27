const apiBaseUrl = process.env.API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("API_BASE_URL is not configured");
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API GET ${path} failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API POST ${path} failed with ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function apiPatch<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API PATCH ${path} failed with ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export type FriendlyError = {
  detail?: string;
  message: string;
};

function buildUrl(path: string) {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  const apiPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${apiPath}`;
}

function buildHeaders(token?: string) {
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isConnectionError(message: string) {
  return /Network request failed|Failed to fetch|Load failed|NetworkError|ECONNREFUSED|Unable to resolve host|timed out/i.test(
    message,
  );
}

export function getFriendlyError(
  error: unknown,
  fallbackMessage: string,
): FriendlyError {
  const detail = error instanceof Error ? error.message : '';

  if (detail && isConnectionError(detail)) {
    return {
      detail,
      message: 'Unable to connect. Check your internet connection and try again.',
    };
  }

  if (!detail) {
    return { message: fallbackMessage };
  }

  return {
    detail,
    message: fallbackMessage,
  };
}

async function getErrorMessage(response: Response, fallback: string) {
  const text = await response.text();

  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text) as { error?: unknown; message?: unknown };

    if (typeof payload.message === 'string') {
      return payload.message;
    }

    if (Array.isArray(payload.message)) {
      return payload.message
        .filter((message): message is string => typeof message === 'string')
        .join('\n');
    }

    if (typeof payload.error === 'string') {
      return payload.error;
    }
  } catch {
    return text;
  }

  return fallback;
}

export async function apiGet<TResponse>(
  path: string,
  token?: string,
): Promise<TResponse> {
  const response = await fetch(buildUrl(path), {
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `API GET ${path} failed with status ${response.status}`,
      ),
    );
  }

  return response.json() as Promise<TResponse>;
}

export async function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
  token?: string,
): Promise<TResponse> {
  const response = await fetch(buildUrl(path), {
    body: JSON.stringify(body),
    headers: {
      ...buildHeaders(token),
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `API POST ${path} failed with status ${response.status}`,
      ),
    );
  }

  return response.json() as Promise<TResponse>;
}

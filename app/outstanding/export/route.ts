const apiBaseUrl = process.env.API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("API_BASE_URL is not configured");
}

function getBackendPath(customerId: string | null) {
  if (!customerId) {
    return "/outstanding/export";
  }

  return `/outstanding/export?customerId=${encodeURIComponent(customerId)}`;
}

function getForwardedHeaders(response: Response) {
  const headers = new Headers();
  const contentType = response.headers.get("Content-Type");
  const contentDisposition = response.headers.get("Content-Disposition");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition);
  }

  return headers;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const backendResponse = await fetch(
    `${apiBaseUrl}${getBackendPath(url.searchParams.get("customerId"))}`,
    {
      cache: "no-store",
    },
  );
  const text = await backendResponse.text();

  return new Response(text, {
    headers: getForwardedHeaders(backendResponse),
    status: backendResponse.status,
  });
}

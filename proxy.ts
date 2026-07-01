import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type CookieToSet = {
  name: string;
  options: CookieOptions;
  value: string;
};

function getSupabaseConfig() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }

  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured");
  }

  return {
    supabaseAnonKey,
    supabaseUrl,
  };
}

function isProtectedRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname === "/outstanding" ||
    pathname === "/aging" ||
    pathname === "/search" ||
    pathname === "/customers" ||
    pathname.startsWith("/customers/") ||
    pathname === "/invoices" ||
    pathname.startsWith("/invoices/") ||
    pathname === "/payments" ||
    pathname.startsWith("/payments/") ||
    pathname === "/cheques" ||
    pathname.startsWith("/cheques/")
  );
}

function applyAuthUpdates(
  response: NextResponse,
  cookiesToSet: CookieToSet[],
  headersToSet: Record<string, string>,
) {
  Object.entries(headersToSet).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

export async function proxy(request: NextRequest) {
  const { supabaseAnonKey, supabaseUrl } = getSupabaseConfig();
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({ request });
  let cookiesToSet: CookieToSet[] = [];
  let headersToSet: Record<string, string> = {};

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookiesToSet, nextHeadersToSet) {
        cookiesToSet = nextCookiesToSet;
        headersToSet = nextHeadersToSet;

        nextCookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        applyAuthUpdates(response, cookiesToSet, headersToSet);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  if (!isAuthenticated && isProtectedRoute(pathname)) {
    return applyAuthUpdates(
      NextResponse.redirect(new URL("/login", request.url)),
      cookiesToSet,
      headersToSet,
    );
  }

  if (isAuthenticated && pathname === "/login") {
    return applyAuthUpdates(
      NextResponse.redirect(new URL("/", request.url)),
      cookiesToSet,
      headersToSet,
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/customers/:path*",
    "/invoices/:path*",
    "/payments/:path*",
    "/cheques/:path*",
    "/dashboard",
    "/outstanding",
    "/aging",
    "/search",
  ],
};

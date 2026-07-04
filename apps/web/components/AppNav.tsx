"use client";

import Link from "next/link";
import Image from "next/image";
import { LogOut, Search, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type AuthenticatedUser,
  getAuthenticatedUser,
  isAuthMeUnauthorizedError,
} from "@/lib/auth-user";
import { supabase } from "@/lib/supabase-client";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/cheques", label: "Cheques" },
  { href: "/outstanding", label: "Outstanding" },
  { href: "/aging", label: "Aging" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatRole(role: AuthenticatedUser["role"]) {
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (isMounted) {
        setIsUserLoading(true);
      }

      try {
        const authenticatedUser = await getAuthenticatedUser();

        if (isMounted) {
          setUser(authenticatedUser);
        }
      } catch (error) {
        if (isAuthMeUnauthorizedError(error)) {
          router.push("/login");
          return;
        }

        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsUserLoading(false);
        }
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setIsUserLoading(false);
        router.push("/login");
        return;
      }

      void loadUser();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-base font-semibold tracking-tight text-zinc-950 transition-colors hover:text-[#0f77a8]"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-[#0f77a8]/10 ring-1 ring-[#0f77a8]/15">
              <Image
                src="/icon.png"
                alt="Distribio"
                width={24}
                height={24}
                className="rounded-lg"
                priority
              />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-base font-bold">Distribio</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0f77a8]">
                Distribution Chain
              </span>
            </span>
          </Link>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-md">
            <form
              action="/search"
              className="relative w-full"
              role="search"
            >
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <input
                type="search"
                name="q"
                placeholder="Search customers, invoices, payments..."
                className="h-10 w-full rounded-full border border-zinc-200 bg-zinc-50/80 pl-9 pr-4 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#0f77a8] focus:bg-white focus:ring-2 focus:ring-[#0f77a8]/15"
              />
            </form>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open profile menu"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm shadow-zinc-950/5 transition-colors hover:bg-zinc-50 hover:text-zinc-950"
                >
                  <UserCircle className="size-5" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  {isUserLoading ? (
                    <span className="block text-sm font-medium">
                      Loading profile...
                    </span>
                  ) : user ? (
                    <span className="grid gap-1">
                      <span className="truncate text-sm font-medium">
                        {user.name}
                      </span>
                      <span className="truncate text-xs font-normal text-zinc-500">
                        {user.email}
                      </span>
                      <span className="text-xs font-normal text-zinc-500">
                        Role: {formatRole(user.role)}
                      </span>
                    </span>
                  ) : (
                    <span className="block text-sm font-medium">
                      Signed in
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav aria-label="Primary navigation" className="flex flex-wrap gap-1.5">
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "inline-flex h-9 items-center justify-center rounded-full bg-[#0f77a8] px-3.5 text-sm font-semibold text-white shadow-sm shadow-[#0f77a8]/20"
                    : "inline-flex h-9 items-center justify-center rounded-full px-3.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-[#0f77a8]/10 hover:text-[#0f77a8]"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

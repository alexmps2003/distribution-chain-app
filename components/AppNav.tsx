"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

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

export default function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link
            href="/"
            className="text-base font-medium tracking-tight text-zinc-950 transition-colors hover:text-zinc-700"
          >
            Distribution Chain
          </Link>
          <form
            action="/search"
            className="relative w-full lg:max-w-sm"
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
              className="h-10 w-full rounded-full border border-zinc-200 bg-zinc-50/80 pl-9 pr-4 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
            />
          </form>
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
                    ? "inline-flex h-9 items-center justify-center rounded-full bg-zinc-950 px-3.5 text-sm font-medium text-white shadow-sm shadow-zinc-950/10"
                    : "inline-flex h-9 items-center justify-center rounded-full px-3.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
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

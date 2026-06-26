"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/cheques", label: "Cheques" },
  { href: "/outstanding", label: "Outstanding" },
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="text-base font-medium tracking-tight text-zinc-950 transition-colors hover:text-zinc-700"
        >
          Distribution Chain
        </Link>
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

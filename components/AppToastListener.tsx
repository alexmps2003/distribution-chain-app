"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const toastDurations = {
  error: 4500,
  info: 3500,
  success: 3500,
  warning: 4000,
} as const;

function isToastType(value: string | null): value is keyof typeof toastDurations {
  return (
    value === "error" ||
    value === "info" ||
    value === "success" ||
    value === "warning"
  );
}

export default function AppToastListener() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toastType = searchParams.get("toastType");
  const toastMessage = searchParams.get("toastMessage");

  useEffect(() => {
    if (!toastMessage || !isToastType(toastType)) {
      return;
    }

    toast[toastType](toastMessage, {
      duration: toastDurations[toastType],
    });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("toastType");
    params.delete("toastMessage");

    const query = params.toString();

    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams, toastMessage, toastType]);

  return null;
}

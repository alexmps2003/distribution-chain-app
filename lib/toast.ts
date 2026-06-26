export type ToastType = "error" | "info" | "success" | "warning";

export function withToast(path: string, type: ToastType, message: string) {
  const [pathname, queryString = ""] = path.split("?");
  const params = new URLSearchParams(queryString);

  params.set("toastType", type);
  params.set("toastMessage", message);

  return `${pathname}?${params.toString()}`;
}

import { FileText } from "lucide-react";
import { NotFoundState } from "@/components/ErrorState";

export default function NotFound() {
  return (
    <NotFoundState
      icon={FileText}
      title="Invoice not found"
      description="This invoice may have been removed, or the link may no longer be valid."
    />
  );
}

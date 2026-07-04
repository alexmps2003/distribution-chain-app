import { Users } from "lucide-react";
import { NotFoundState } from "@/components/ErrorState";

export default function NotFound() {
  return (
    <NotFoundState
      icon={Users}
      title="Customer not found"
      description="This customer may have been removed, or the link may no longer be valid."
    />
  );
}

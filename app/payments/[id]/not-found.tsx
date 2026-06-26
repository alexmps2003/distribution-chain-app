import { CreditCard } from "lucide-react";
import { NotFoundState } from "@/components/ErrorState";

export default function NotFound() {
  return (
    <NotFoundState
      icon={CreditCard}
      title="Payment not found"
      description="This payment receipt may have been removed, or the link may no longer be valid."
    />
  );
}

"use client";

import { CreditCard } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      icon={CreditCard}
      title="Payments couldn't load"
      description="We couldn't load payment information right now. Please try again."
      onReset={reset}
    />
  );
}

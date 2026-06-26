"use client";

import { Users } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      icon={Users}
      title="Customers couldn't load"
      description="We couldn't load customer information right now. Please try again."
      onReset={reset}
    />
  );
}

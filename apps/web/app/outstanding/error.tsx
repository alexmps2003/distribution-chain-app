"use client";

import { CircleDollarSign } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      icon={CircleDollarSign}
      title="Outstanding report couldn't load"
      description="We couldn't load outstanding balances right now. Please try again."
      onReset={reset}
    />
  );
}

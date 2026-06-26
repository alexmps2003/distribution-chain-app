"use client";

import { Clock3 } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      icon={Clock3}
      title="Aging report couldn't load"
      description="We couldn't load the aging report right now. Please try again."
      onReset={reset}
    />
  );
}

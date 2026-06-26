"use client";

import { ErrorState } from "@/components/ErrorState";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Dashboard couldn't load"
      description="We couldn't load the dashboard right now. Please try again."
      onReset={reset}
    />
  );
}

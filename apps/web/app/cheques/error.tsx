"use client";

import { Landmark } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      icon={Landmark}
      title="Cheques couldn't load"
      description="We couldn't load cheque information right now. Please try again."
      onReset={reset}
    />
  );
}

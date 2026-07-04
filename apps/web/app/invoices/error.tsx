"use client";

import { FileText } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      icon={FileText}
      title="Invoices couldn't load"
      description="We couldn't load invoice information right now. Please try again."
      onReset={reset}
    />
  );
}

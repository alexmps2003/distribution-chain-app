import { Landmark } from "lucide-react";
import { NotFoundState } from "@/components/ErrorState";

export default function NotFound() {
  return (
    <NotFoundState
      icon={Landmark}
      title="Cheque not found"
      description="This cheque may have been removed, or the link may no longer be valid."
    />
  );
}

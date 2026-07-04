import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ErrorState({
  description = "Something went wrong while loading this page. Please try again.",
  icon: Icon = AlertTriangle,
  onReset,
  title = "We couldn't load this page",
}: {
  description?: string;
  icon?: LucideIcon;
  onReset?: () => void;
  title?: string;
}) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center py-16">
        <Card className="w-full max-w-xl border-zinc-200/80 bg-white/95 shadow-sm shadow-zinc-950/[0.04]">
          <CardHeader className="items-center text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
            <CardDescription className="max-w-md leading-6">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col justify-center gap-3 sm:flex-row">
            {onReset ? (
              <Button
                type="button"
                onClick={onReset}
                className="h-10 bg-zinc-950 px-4 text-white hover:bg-zinc-800"
              >
                Try Again
              </Button>
            ) : null}
            <Button asChild variant="outline" className="h-10 px-4">
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export function NotFoundState({
  description,
  icon: Icon = AlertTriangle,
  title,
}: {
  description: string;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center py-16">
        <Card className="w-full max-w-xl border-zinc-200/80 bg-white/95 shadow-sm shadow-zinc-950/[0.04]">
          <CardHeader className="items-center text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
            <CardDescription className="max-w-md leading-6">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild variant="outline" className="h-10 px-4">
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

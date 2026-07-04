import type { Metadata } from "next";
import { Suspense } from "react";
import AppNav from "@/components/AppNav";
import AppToastListener from "@/components/AppToastListener";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Distribio",
    template: "%s | Distribio",
  },
  description:
    "Modern distribution chain management for customers, invoices, payments, cheques, and collections.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppNav />
        {children}
        <Suspense fallback={null}>
          <AppToastListener />
        </Suspense>
        <Toaster richColors closeButton duration={3500} />
      </body>
    </html>
  );
}

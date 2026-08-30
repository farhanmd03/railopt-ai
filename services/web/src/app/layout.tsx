import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "RailOpt AI — Howrah Division Railway Maintenance Planning",
  description:
    "AI-Powered Multi-Department Railway Maintenance Block Planning & Optimization (SIH26027)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[var(--background)]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

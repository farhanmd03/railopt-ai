import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RailOpt AI — Howrah Division Railway Possession Planning",
    template: "%s | RailOpt AI",
  },
  description:
    "AI-Powered Multi-Department Railway Maintenance Block Planning & Optimization Platform — Ministry of Railways / Eastern Railway (Howrah Division)",
  icons: {
    icon: "/icon.svg",
  },
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

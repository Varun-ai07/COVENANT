import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";

const Providers = dynamic(() => import("./providers"), { ssr: false });
const AppShell = dynamic(() => import("@/components/layout/AppShell"), {
  ssr: false,
});

const metadata: Metadata = {
  title: "COVENANT — Autonomous Agent Enforcement",
  description:
    "What TCP/IP was to computers, COVENANT is to AI agents. An autonomous agent enforcement protocol on Base Sepolia.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen font-body antialiased overflow-x-hidden grain-overlay">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

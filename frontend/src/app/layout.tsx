import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";

const Providers = dynamic(() => import("./providers"), { ssr: false });
const Navbar = dynamic(() => import("@/components/layout/Navbar"), { ssr: false });
const ClientLayout = dynamic(() => import("@/components/layout/ClientLayout"), { ssr: false });
const NeuralBackground = dynamic(() => import("@/components/neural/NeuralBackground"), { ssr: false });

const metadata: Metadata = {
  title: "COVENANT — Agentic Nervous System",
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
      <body className="bg-void-void text-white min-h-screen font-body antialiased overflow-x-hidden">
        <Providers>
          <NeuralBackground />
          <div className="fixed inset-0 z-0 pointer-events-none">
            <div className="mesh-gradient" />
          </div>
          <div className="relative z-10">
            <Navbar />
            <ClientLayout>{children}</ClientLayout>
          </div>
        </Providers>
      </body>
    </html>
  );
}

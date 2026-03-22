import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import dynamic from "next/dynamic";

const ClientLayout = dynamic(() => import("@/components/ClientLayout"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 animate-pulse-glow relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 opacity-20 blur-xl" />
          <div className="relative w-full h-full bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <p className="text-slate-400 text-lg font-medium tracking-wide">Loading COVENANT</p>
      </div>
    </div>
  ),
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "COVENANT - Agent Enforcement Protocol",
  description: "Trustless agent-to-agent interactions on-chain. Register, discover, negotiate, and enforce agreements autonomously.",
  keywords: ["blockchain", "agents", "escrow", "ERC-8004", "Base", "web3"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#020617] text-white min-h-screen`}
      >
        {/* Animated mesh gradient background */}
        <div className="mesh-gradient" />

        {/* Grid pattern overlay */}
        <div className="grid-pattern fixed inset-0 z-[-1] pointer-events-none" />

        {/* Noise texture */}
        <div className="noise-overlay" />

        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { ThemeProvider } from "next-themes";
import dynamic from "next/dynamic";
import { config } from "@/config/wagmi";
import { Suspense } from "react";

// Lazy load SmoothCursor to reduce initial bundle
const SmoothCursor = dynamic(
  () => import("@/components/ui/SmoothCursor").then((mod) => mod.SmoothCursor),
  { ssr: false, loading: () => null }
);

// Single QueryClient instance with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Custom RainbowKit theme using CSS variables
const covenantDarkTheme = darkTheme({
  accentColor: "#00FF88",
  accentColorForeground: "#050505",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});

// Loading fallback that shows immediately
const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <span className="text-micro-lg font-mono text-foreground-muted">Loading...</span>
    </div>
  </div>
);

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={covenantDarkTheme} modalSize="compact">
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
      <SmoothCursor />
    </ThemeProvider>
  );
}

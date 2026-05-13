"use client";

import dynamic from "next/dynamic";

const ClientLayout = dynamic(() => import("./ClientLayout"), { ssr: false });

/**
 * AppShell for dashboard/utility pages
 * Homepage has its own layout with Ticker → MegaNav → Content
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <ClientLayout>{children}</ClientLayout>
    </div>
  );
}

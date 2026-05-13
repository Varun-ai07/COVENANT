"use client";

import dynamic from "next/dynamic";

const MegaNav = dynamic(() => import("./MegaNav"), { ssr: false });
const ClientLayout = dynamic(() => import("./ClientLayout"), { ssr: false });

/**
 * DashboardShell - For all pages except homepage
 * Includes MegaNav at the top
 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <MegaNav />
      <ClientLayout>{children}</ClientLayout>
    </div>
  );
}

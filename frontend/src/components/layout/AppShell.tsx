"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const TopBar = dynamic(() => import("./TopBar"), { ssr: false });
const Sidebar = dynamic(() => import("./Sidebar"), { ssr: false });
const ClientLayout = dynamic(() => import("./ClientLayout"), { ssr: false });

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <TopBar onMenuClick={() => setMobileOpen((v) => !v)} />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          "pt-14 transition-all duration-200",
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-56"
        )}
      >
        <ClientLayout>{children}</ClientLayout>
      </div>
    </>
  );
}

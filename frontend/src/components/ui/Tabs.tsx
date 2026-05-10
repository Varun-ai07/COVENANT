"use client";

import { memo, createContext, useContext, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Context
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound components must be used within Tabs");
  }
  return context;
}

// Main Tabs component
interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

export const Tabs = memo(function Tabs({
  defaultValue,
  children,
  className,
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
});

// TabsList
interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabsList = memo(function TabsList({
  children,
  className,
}: TabsListProps) {
  return (
    <div
      className={cn(
        "flex gap-1 p-1 bg-surface-alt rounded-lg border border-border",
        className
      )}
    >
      {children}
    </div>
  );
});

// TabsTrigger
interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsTrigger = memo(function TabsTrigger({
  value,
  children,
  className,
}: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        "relative px-4 py-2 text-sm font-body rounded-md transition-colors",
        isActive ? "text-foreground" : "text-muted hover:text-foreground",
        className
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-surface rounded-md border border-border"
          transition={{ type: "spring", duration: 0.3 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
});

// TabsContent
interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent = memo(function TabsContent({
  value,
  children,
  className,
}: TabsContentProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

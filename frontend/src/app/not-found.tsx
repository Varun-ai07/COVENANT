"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-center max-w-md"
      >
        <p className="text-7xl font-heading font-bold text-accent mb-2">404</p>
        <h1 className="text-xl font-heading font-semibold text-foreground mb-2">
          Page not found
        </h1>
        <p className="font-body text-muted mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/">
            <Button variant="primary">
              <Home size={14} />
              Go home
            </Button>
          </Link>
          <Button variant="secondary" onClick={() => window.history.back()}>
            <ArrowLeft size={14} />
            Go back
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

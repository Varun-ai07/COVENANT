import Link from "next/link";
import { GitBranch, ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-border bg-surface">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-heading text-lg text-accent">COVENANT</span>
            <span className="text-xs text-muted font-mono">Agentic Nervous System</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted">
            <Link href="/demo" className="hover:text-info transition-colors">
              Interactive Demo
            </Link>
            <a
              href="https://github.com/Varun-ai07/COVENANT"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-info transition-colors"
            >
              <GitBranch size={14} />
              GitHub
              <ExternalLink size={12} />
            </a>
            <a
              href="https://sepolia.basescan.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-info transition-colors"
            >
              Base Sepolia
            </a>
          </div>
          <div className="text-xs text-muted/60 font-mono">
            v2.0.0 — {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </footer>
  );
}

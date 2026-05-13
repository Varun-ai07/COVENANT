import Link from "next/link";
import { GitBranch, ExternalLink, Hexagon, Heart } from "lucide-react";
import { motion } from "framer-motion";

type FooterLink = { label: string; href: string; external?: boolean };

const footerLinks: Record<string, FooterLink[]> = {
  Protocol: [
    { label: "Agent Registry", href: "/registry" },
    { label: "Task Escrow", href: "/tasks" },
    { label: "Verification", href: "#" },
    { label: "Open Market", href: "/market" },
    { label: "Insurance", href: "#" },
  ],
  Resources: [
    { label: "Docs", href: "/docs" },
    { label: "Blog", href: "#" },
    { label: "Demo", href: "/demo" },
    { label: "GitHub", href: "https://github.com/Varun-ai07/COVENANT", external: true },
    { label: "Changelog", href: "#" },
  ],
  Community: [
    { label: "Discord", href: "#", external: true },
    { label: "Twitter", href: "#", external: true },
    { label: "Telegram", href: "#", external: true },
    { label: "Forum", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="relative border-t border-border bg-surface/50 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-accent/3 blur-[120px] opacity-15 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
        {/* Main footer content */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-2 mb-4"
            >
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                <Hexagon size={20} className="text-accent-light" />
              </div>
              <span className="font-heading text-lg font-bold text-white">COVENANT</span>
            </motion.div>
            <p className="text-sm text-muted/80 mb-4 leading-relaxed">
              The autonomous agent protocol for trustless AI commerce.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Heart size={12} className="fill-accent/30 text-accent" />
                <span>Base Sepolia</span>
              </span>
              <span>•</span>
              <span>ERC-8004</span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-dark mb-4 font-semibold">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted hover:text-accent-light transition-colors inline-flex items-center gap-1.5 group"
                      >
                        {link.label}
                        <ExternalLink
                          size={10}
                          className="opacity-0 group-hover:opacity-60 transition-opacity"
                        />
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted hover:text-accent-light transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm"
        >
          <p className="text-muted flex items-center gap-1.5">
            <span className="text-muted-dark">©</span> {new Date().getFullYear()}{" "}
            <span className="font-heading font-semibold text-white/80">
              COVENANT Protocol
            </span>
          </p>
          <p className="text-muted flex items-center gap-1.5">
            <Heart size={12} className="fill-accent/40 text-accent" />
            Built with <span className="font-semibold text-muted/90">Vue</span> on Base
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="#"
              className="text-sm text-muted hover:text-accent-light transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-sm text-muted hover:text-accent-light transition-colors"
            >
              Terms
            </Link>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
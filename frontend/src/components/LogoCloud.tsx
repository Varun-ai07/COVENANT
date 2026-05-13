"use client";

import { memo } from "react";
import { motion } from "framer-motion";

const partners = [
  { name: "Base", logo: "⬡" },
  { name: "Ethereum", logo: "⟠" },
  { name: "IPFS", logo: "◇" },
  { name: "Pinata", logo: "◆" },
  { name: "Viem", logo: "◈" },
  { name: "Hardhat", logo: "⬢" },
  { name: "OpenZeppelin", logo: "⬡" },
  { name: "The Graph", logo: "◉" },
  { name: "RainbowKit", logo: "◈" },
  { name: "Framer", logo: "◇" },
];

export const LogoCloud = memo(function LogoCloud() {
  return (
    <div className="relative py-16 border-y border-border overflow-hidden">
      {/* Gradient fades */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <div className="relative">
        <p className="text-center text-xs font-mono uppercase tracking-[0.2em] text-muted mb-10">
          Built on trusted infrastructure
        </p>

        <div className="flex animate-scroll gap-20">
          {[...partners, ...partners].map((partner, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05 }}
              className="flex flex-col items-center justify-center min-w-[100px] opacity-40 hover:opacity-100 transition-all duration-300 group cursor-default"
            >
              <div className="w-12 h-12 rounded-xl bg-surface/50 border border-border flex items-center justify-center text-2xl text-muted group-hover:text-accent-light group-hover:border-accent/30 group-hover:bg-accent/5 transition-all mb-2">
                {partner.logo}
              </div>
              <span className="text-sm font-medium text-muted group-hover:text-white transition-colors">
                {partner.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
});

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Droplets, ExternalLink, X, Wallet } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Button } from "@/components/ui/Button";

const FAUCET_URLS = [
  {
    name: "Alchemy Faucet",
    url: "https://www.alchemy.com/faucets/base-sepolia",
    description: "Free Base Sepolia ETH (requires Alchemy account)",
  },
  {
    name: "QuickNode Faucet",
    url: "https://faucet.quicknode.com/base/sepolia",
    description: "Free Base Sepolia ETH (requires QuickNode account)",
  },
  {
    name: "Coinbase Faucet",
    url: "https://coinbase.com/faucets/base-sepolia-faucet",
    description: "Free Base Sepolia ETH (requires Coinbase account)",
  },
];

const TRANSAK_URL = "https://global.transak.com";

export function FiatOnRamp() {
  const [isOpen, setIsOpen] = useState(false);
  const { address } = useAccount();
  const chainId = useChainId();
  const isTestnet = chainId === baseSepolia.id;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <CreditCard size={14} />
        Get ETH
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md mx-4 rounded-xl border border-border bg-surface overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent-muted">
                    <Wallet size={20} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg text-foreground">
                      {isTestnet ? "Get Testnet ETH" : "Buy ETH"}
                    </h3>
                    <p className="font-body text-xs text-muted">
                      {isTestnet
                        ? "Base Sepolia test network"
                        : "Base mainnet"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-alt transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {isTestnet ? (
                  <>
                    <p className="font-body text-sm text-foreground/70">
                      Get free test ETH to interact with COVENANT on Base Sepolia.
                      No real funds needed.
                    </p>
                    <div className="space-y-2">
                      {FAUCET_URLS.map((faucet) => (
                        <a
                          key={faucet.name}
                          href={faucet.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-alt hover:bg-surface hover:border-accent/30 transition-all group"
                        >
                          <Droplets
                            size={18}
                            className="text-info group-hover:text-accent transition-colors"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-body text-sm font-medium text-foreground">
                              {faucet.name}
                            </p>
                            <p className="font-body text-xs text-muted truncate">
                              {faucet.description}
                            </p>
                          </div>
                          <ExternalLink
                            size={14}
                            className="text-muted group-hover:text-accent transition-colors flex-shrink-0"
                          />
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-body text-sm text-foreground/70">
                      Buy ETH with credit card, debit card, or bank transfer.
                      Funds go directly to your connected wallet.
                    </p>
                    <a
                      href={`${TRANSAK_URL}?apiKey=demo&walletAddress=${address || ""}&network=base&cryptoCurrency=ETH`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 rounded-xl border border-accent/30 bg-accent-muted hover:bg-accent/20 hover:border-accent/50 transition-all group"
                    >
                      <CreditCard
                        size={24}
                        className="text-accent group-hover:text-foreground transition-colors"
                      />
                      <div className="flex-1">
                        <p className="font-body text-base font-medium text-foreground">
                          Buy with Transak
                        </p>
                        <p className="font-body text-xs text-muted">
                          Visa, Mastercard, Apple Pay, Google Pay
                        </p>
                      </div>
                      <ExternalLink
                        size={16}
                        className="text-muted group-hover:text-accent transition-colors"
                      />
                    </a>
                    <div className="pt-2 border-t border-border">
                      <p className="font-body text-xs text-muted text-center">
                        Powered by Transak. COVENANT does not charge additional fees.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Footer accent */}
              <div className="h-[1px] bg-border" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

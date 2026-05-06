"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Droplets, ExternalLink, X, Wallet } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { NeonButton } from "@/components/ui/NeonButton";

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
      <NeonButton
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <CreditCard size={14} />
        Get ETH
      </NeonButton>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md mx-4 rounded-2xl border border-glass-border bg-neural-dark/95 backdrop-blur-xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-glass-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-synapse-violet/20">
                    <Wallet size={20} className="text-synapse-violet" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg text-white">
                      {isTestnet ? "Get Testnet ETH" : "Buy ETH"}
                    </h3>
                    <p className="font-body text-xs text-gray-400">
                      {isTestnet
                        ? "Base Sepolia test network"
                        : "Base mainnet"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-glass transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {isTestnet ? (
                  <>
                    <p className="font-body text-sm text-gray-300">
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
                          className="flex items-center gap-3 p-3 rounded-xl border border-glass-border bg-glass/50 hover:bg-glass hover:border-synapse-violet/30 transition-all group"
                        >
                          <Droplets
                            size={18}
                            className="text-biolum-cyan group-hover:text-synapse-violet transition-colors"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-body text-sm font-medium text-white">
                              {faucet.name}
                            </p>
                            <p className="font-body text-xs text-gray-400 truncate">
                              {faucet.description}
                            </p>
                          </div>
                          <ExternalLink
                            size={14}
                            className="text-gray-500 group-hover:text-synapse-violet transition-colors flex-shrink-0"
                          />
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-body text-sm text-gray-300">
                      Buy ETH with credit card, debit card, or bank transfer.
                      Funds go directly to your connected wallet.
                    </p>
                    <a
                      href={`${TRANSAK_URL}?apiKey=demo&walletAddress=${address || ""}&network=base&cryptoCurrency=ETH`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 rounded-xl border border-plasma-pink/30 bg-plasma-pink/10 hover:bg-plasma-pink/20 hover:border-plasma-pink/50 transition-all group"
                    >
                      <CreditCard
                        size={24}
                        className="text-plasma-pink group-hover:text-white transition-colors"
                      />
                      <div className="flex-1">
                        <p className="font-body text-base font-medium text-white">
                          Buy with Transak
                        </p>
                        <p className="font-body text-xs text-gray-400">
                          Visa, Mastercard, Apple Pay, Google Pay
                        </p>
                      </div>
                      <ExternalLink
                        size={16}
                        className="text-gray-500 group-hover:text-plasma-pink transition-colors"
                      />
                    </a>
                    <div className="pt-2 border-t border-glass-border">
                      <p className="font-body text-xs text-gray-500 text-center">
                        Powered by Transak. COVENANT does not charge additional fees.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Footer accent */}
              <div className="h-[2px] bg-gradient-to-r from-transparent via-synapse-violet/50 to-transparent" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

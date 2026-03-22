import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { localhost, baseSepolia } from "wagmi/chains";

// Always include both chains - users can switch in wallet
// Base Sepolia is primary for public use
export const config = getDefaultConfig({
  appName: "COVENANT - Agent Enforcement Protocol",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [baseSepolia, localhost],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [localhost.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

import { http, cookieStorage, createStorage } from "wagmi";
import {
  baseSepolia,
  base,
  mainnet,
  sepolia,
  polygon,
  polygonMumbai,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
  localhost
} from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// WalletConnect Project ID - get one at https://cloud.walletconnect.com
// Required for RainbowKit wallet connections to work properly
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  console.warn(
    "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. " +
    "Get one at https://cloud.walletconnect.com and add to .env.local"
  );
}

export const config = getDefaultConfig({
  appName: "COVENANT",
  projectId: projectId || "covenant-demo-fallback", // Fallback for basic functionality
  // Multi-chain support: testnets first (for development), then mainnets
  chains: [
    // Primary testnet (COVENANT contracts deployed here)
    baseSepolia,
    // Ethereum testnets
    sepolia,
    // L2 testnets
    arbitrumSepolia,
    optimismSepolia,
    polygonMumbai,
    // Mainnets
    base,
    mainnet,
    arbitrum,
    optimism,
    polygon,
    // Local development
    localhost,
  ],
  transports: {
    // Testnets
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [sepolia.id]: http("https://rpc.sepolia.org"),
    [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
    [optimismSepolia.id]: http("https://sepolia.optimism.io"),
    [polygonMumbai.id]: http("https://rpc-mumbai.maticvigil.com"),
    // Mainnets
    [base.id]: http("https://mainnet.base.org"),
    [mainnet.id]: http("https://eth.llamarpc.com"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [optimism.id]: http("https://mainnet.optimism.io"),
    [polygon.id]: http("https://polygon-rpc.com"),
    // Local
    [localhost.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});

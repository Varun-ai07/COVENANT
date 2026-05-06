import { http, cookieStorage, createStorage } from "wagmi";
import { baseSepolia, localhost } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const config = getDefaultConfig({
  appName: "COVENANT",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [baseSepolia, localhost],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [localhost.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});

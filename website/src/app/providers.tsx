"use client";

import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { wagmiAdapter, networks, projectId } from "@/lib/wagmi";

const queryClient = new QueryClient();

createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId!,
  networks,
  defaultNetwork: networks[0],
  metadata: {
    name: "OLOS Gaming",
    description: "Play, Complete, Win — skill-based 1v1 gaming",
    url: typeof window !== "undefined" ? window.location.origin : "https://olos.gg",
    icons: ["/favicon.ico"],
  },
  features: {
    analytics: true,
    email: false,   // keep false — you have your own email auth
    socials: [],    // keep empty — you have your own Google/Apple auth
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#3B82F6",        // matches olos-blue
    "--w3m-border-radius-master": "8px",
  },
});

interface ProvidersProps {
  children: ReactNode;
  initialState?: State;
}

export function Web3Providers({ children, initialState }: ProvidersProps) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
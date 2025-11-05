import type { SolanaClientConfig, WalletConnector } from '@solana/client-core';
import {
    SolanaClientProvider,
    useConnectWallet,
    useWallet,
    useWalletStandardConnectors,
} from '@solana/react-hooks';
import { useEffect, useMemo, useRef } from 'react';

import { BalanceCard } from './components/BalanceCard.tsx';
import { ClusterStatusCard } from './components/ClusterStatusCard.tsx';
import { SolTransferForm } from './components/SolTransferForm.tsx';
import { SplTokenPanel } from './components/SplTokenPanel.tsx';
import { WalletControls } from './components/WalletControls.tsx';

const LAST_CONNECTOR_STORAGE_KEY = 'solana:last-connector';

const DEFAULT_CLIENT_CONFIG: SolanaClientConfig = {
    commitment: 'confirmed',
    endpoint: 'https://api.devnet.solana.com',
    websocketEndpoint: 'wss://api.devnet.solana.com',
};

export default function App() {
    const walletConnectors = useWalletStandardConnectors();

    const clientConfig = useMemo<SolanaClientConfig>(
        () => ({
            ...DEFAULT_CLIENT_CONFIG,
            walletConnectors,
        }),
        [walletConnectors],
    );

    return (
        <SolanaClientProvider config={clientConfig}>
            <DemoApp connectors={walletConnectors} />
        </SolanaClientProvider>
    );
}

type DemoAppProps = Readonly<{
    connectors: readonly WalletConnector[];
}>;

function DemoApp({ connectors }: DemoAppProps) {
    const connectWallet = useConnectWallet();
    const wallet = useWallet();
    const attemptedAutoConnect = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        if (wallet.status === 'connected') {
            window.localStorage.setItem(LAST_CONNECTOR_STORAGE_KEY, wallet.connectorId);
        } else if (wallet.status === 'disconnected') {
            window.localStorage.removeItem(LAST_CONNECTOR_STORAGE_KEY);
        }
    }, [wallet]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        if (attemptedAutoConnect.current) {
            return;
        }
        if (!connectors.length) {
            return;
        }
        if (wallet.status !== 'disconnected' && wallet.status !== 'error') {
            return;
        }
        const lastConnectorId = window.localStorage.getItem(LAST_CONNECTOR_STORAGE_KEY);
        if (!lastConnectorId) {
            attemptedAutoConnect.current = true;
            return;
        }
        const candidate = connectors.find(
            connector => connector.id === lastConnectorId && connector.canAutoConnect,
        );
        if (!candidate) {
            attemptedAutoConnect.current = true;
            window.localStorage.removeItem(LAST_CONNECTOR_STORAGE_KEY);
            return;
        }
        attemptedAutoConnect.current = true;
        void connectWallet(candidate.id, { autoConnect: true }).catch(() => {
            window.localStorage.removeItem(LAST_CONNECTOR_STORAGE_KEY);
        });
    }, [connectWallet, connectors, wallet.status]);

    return (
        <div className="relative min-h-screen">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
            </div>
            <div className="container mx-auto max-w-6xl space-y-8 py-12">
                <header className="space-y-4 text-center sm:text-left">
                    <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary shadow-xs">
                        React Hooks
                    </span>
                    <h1>Solana Client Toolkit</h1>
                    <p>
                        This example wraps the headless <code>@solana/client-core</code> with a React context provider and
                        showcases the hooks exposed by <code>@solana/react-hooks</code>.
                    </p>
                </header>
                <div className="grid gap-6 md:grid-cols-2">
                    <ClusterStatusCard />
                    <WalletControls connectors={connectors} />
                    <BalanceCard />
                    <SolTransferForm />
                    <SplTokenPanel />
                </div>
            </div>
        </div>
    );
}

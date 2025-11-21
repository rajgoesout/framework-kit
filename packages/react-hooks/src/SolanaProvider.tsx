'use client';

import type { SolanaClient, SolanaClientConfig } from '@solana/client';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { SWRConfiguration } from 'swr';

import { SolanaClientProvider, useSolanaClient } from './context';
import { useConnectWallet, useWallet } from './hooks';
import { SolanaQueryProvider } from './QueryProvider';

type QueryLayerConfig = Readonly<{
	config?: SWRConfiguration;
	resetOnClusterChange?: boolean;
	suspense?: boolean;
	disabled?: boolean;
}>;

type StorageAdapter = Readonly<{
	getItem(key: string): string | null;
	removeItem(key: string): void;
	setItem(key: string, value: string): void;
}>;

type WalletPersistenceConfig = Readonly<{
	autoConnect?: boolean;
	storage?: StorageAdapter | null;
	storageKey?: string;
}>;

type SolanaProviderProps = Readonly<{
	children: ReactNode;
	client?: SolanaClient;
	config?: SolanaClientConfig;
	query?: QueryLayerConfig | false;
	walletPersistence?: WalletPersistenceConfig | false;
}>;

/**
 * Convenience provider that composes {@link SolanaClientProvider} with {@link SolanaQueryProvider}.
 *
 * Useful when you want one drop-in wrapper that handles client setup plus SWR configuration without
 * introducing any additional contexts.
 */
export function SolanaProvider({ children, client, config, query, walletPersistence }: SolanaProviderProps) {
	const shouldIncludeQueryLayer = query !== false && query?.disabled !== true;
	const queryProps: QueryLayerConfig = shouldIncludeQueryLayer && query ? query : {};
	const persistenceConfig = walletPersistence === false ? undefined : (walletPersistence ?? {});

	const content = shouldIncludeQueryLayer ? (
		<SolanaQueryProvider
			config={queryProps.config}
			resetOnClusterChange={queryProps.resetOnClusterChange}
			suspense={queryProps.suspense}
		>
			{children}
		</SolanaQueryProvider>
	) : (
		children
	);

	return (
		<SolanaClientProvider client={client} config={config}>
			{persistenceConfig ? <WalletPersistence {...persistenceConfig} /> : null}
			{content}
		</SolanaClientProvider>
	);
}

const DEFAULT_STORAGE_KEY = 'solana:last-connector';

function WalletPersistence({ autoConnect = true, storage, storageKey = DEFAULT_STORAGE_KEY }: WalletPersistenceConfig) {
	const wallet = useWallet();
	const connectWallet = useConnectWallet();
	const client = useSolanaClient();
	const storageRef = useRef<StorageAdapter | null>(storage ?? getDefaultStorage());
	const [hasAttemptedAutoConnect, setHasAttemptedAutoConnect] = useState(false);
	const hasPersistedConnectorRef = useRef(false);
	const clientRef = useRef<SolanaClient | null>(null);

	useEffect(() => {
		storageRef.current = storage ?? getDefaultStorage();
	}, [storage]);

	useEffect(() => {
		if (clientRef.current !== client) {
			clientRef.current = client;
			setHasAttemptedAutoConnect(false);
		}
	}, [client]);

	useEffect(() => {
		const activeStorage = storageRef.current;
		if (!activeStorage) return;
		if ('connectorId' in wallet && wallet.connectorId) {
			const connectorId = wallet.connectorId;
			if (connectorId) {
				safelyWrite(() => activeStorage.setItem(storageKey, connectorId));
				hasPersistedConnectorRef.current = true;
				return;
			}
		}
		if (wallet.status === 'disconnected' && hasPersistedConnectorRef.current) {
			safelyWrite(() => activeStorage.removeItem(storageKey));
			hasPersistedConnectorRef.current = false;
		}
	}, [storageKey, wallet]);

	useEffect(() => {
		if (!autoConnect || hasAttemptedAutoConnect) {
			return;
		}
		if (wallet.status === 'connected' || wallet.status === 'connecting') {
			setHasAttemptedAutoConnect(true);
			return;
		}
		const activeStorage = storageRef.current;
		if (!activeStorage) {
			setHasAttemptedAutoConnect(true);
			return;
		}

		let cancelled = false;
		const connectorId = safelyRead(() => activeStorage.getItem(storageKey));
		if (!connectorId) {
			setHasAttemptedAutoConnect(true);
			return;
		}

		const connector = client.connectors.get(connectorId);
		if (!connector) {
			// Connector not yet registered; wait for the client to refresh.
			return;
		}

		void (async () => {
			try {
				await connectWallet(connectorId, { autoConnect: true });
			} catch {
				// Ignore auto-connect failures; consumers can handle manual retries via hooks.
			} finally {
				if (!cancelled) {
					setHasAttemptedAutoConnect(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [autoConnect, client, connectWallet, hasAttemptedAutoConnect, storageKey, wallet.status]);

	return null;
}

function safelyRead(reader: () => string | null): string | null {
	try {
		return reader();
	} catch {
		return null;
	}
}

function safelyWrite(writer: () => void) {
	try {
		writer();
	} catch {
		// Ignore write failures (private browsing, SSR, etc.).
	}
}

function getDefaultStorage(): StorageAdapter | null {
	if (typeof globalThis !== 'object' || globalThis === null) {
		return null;
	}
	const candidate = (globalThis as Record<string, unknown>).localStorage as StorageAdapter | undefined;
	if (!candidate) {
		return null;
	}
	return candidate;
}

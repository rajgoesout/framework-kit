import type { WalletConnector, WalletSession, WalletStatus } from '@solana/client';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useSolanaClient } from './context';
import { useConnectWallet, useDisconnectWallet, useWallet } from './hooks';

type WalletConnectionState = Readonly<{
	connect(connectorId: string, options?: Readonly<{ autoConnect?: boolean }>): Promise<void>;
	connected: boolean;
	connecting: boolean;
	connectors: readonly WalletConnector[];
	currentConnector?: WalletConnector;
	connectorId?: string;
	disconnect(): Promise<void>;
	error: unknown;
	status: WalletStatus['status'];
	wallet: WalletSession | undefined;
}>;

type UseWalletConnectionOptions = Readonly<{
	connectors?: readonly WalletConnector[];
}>;

/**
 * Collects everything needed to build wallet connection UIs into a single hook.
 */
export function useWalletConnection(options: UseWalletConnectionOptions = {}): WalletConnectionState {
	const wallet = useWallet();
	const connectWallet = useConnectWallet();
	const disconnectWallet = useDisconnectWallet();
	const client = useSolanaClient();
	const connectors = options.connectors ?? client.connectors.all;
	const connect = useCallback(
		(connectorId: string, connectOptions?: Readonly<{ autoConnect?: boolean }>) =>
			connectWallet(connectorId, connectOptions),
		[connectWallet],
	);
	const disconnect = useCallback(() => disconnectWallet(), [disconnectWallet]);

	const state = useMemo<WalletConnectionState>(() => {
		const connectorId = 'connectorId' in wallet ? wallet.connectorId : undefined;
		const currentConnector = connectorId ? connectors.find((connector) => connector.id === connectorId) : undefined;
		const session: WalletSession | undefined = wallet.status === 'connected' ? wallet.session : undefined;
		const error = wallet.status === 'error' ? (wallet.error ?? null) : null;

		return {
			connect,
			connected: wallet.status === 'connected',
			connecting: wallet.status === 'connecting',
			connectors,
			connectorId,
			currentConnector,
			disconnect,
			error,
			status: wallet.status,
			wallet: session,
		};
	}, [connect, connectors, disconnect, wallet]);

	return state;
}

type WalletConnectionManagerProps = Readonly<{
	children: (state: WalletConnectionState) => ReactNode;
	connectors?: readonly WalletConnector[];
}>;

/**
 * Render-prop helper that lets you easily wire wallet status into custom UIs.
 */
export function WalletConnectionManager({ children, connectors }: WalletConnectionManagerProps) {
	const state = useWalletConnection({ connectors });
	return <>{children(state)}</>;
}

type UseWalletModalStateOptions = UseWalletConnectionOptions &
	Readonly<{
		closeOnConnect?: boolean;
		initialOpen?: boolean;
	}>;

export type WalletModalState = WalletConnectionState &
	Readonly<{
		close(): void;
		isOpen: boolean;
		open(): void;
		selectedConnector: string | null;
		select(connectorId: string | null): void;
		toggle(): void;
	}>;

/**
 * Small state machine for wallet selection modals – keeps track of modal visibility and the currently
 * highlighted connector while reusing the connection state returned by {@link useWalletConnection}.
 */
export function useWalletModalState(options: UseWalletModalStateOptions = {}): WalletModalState {
	const connection = useWalletConnection(options);
	const [isOpen, setIsOpen] = useState(options.initialOpen ?? false);
	const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
	const closeOnConnect = options.closeOnConnect ?? true;

	const open = useCallback(() => setIsOpen(true), []);
	const close = useCallback(() => setIsOpen(false), []);
	const toggle = useCallback(() => setIsOpen((value) => !value), []);
	const select = useCallback((connectorId: string | null) => setSelectedConnector(connectorId), []);

	const connect = useCallback(
		async (connectorId: string, connectOptions?: Readonly<{ autoConnect?: boolean }>) => {
			await connection.connect(connectorId, connectOptions);
			setSelectedConnector(connectorId);
			if (closeOnConnect) {
				setIsOpen(false);
			}
		},
		[closeOnConnect, connection],
	);

	return {
		...connection,
		close,
		connect,
		isOpen,
		open,
		selectedConnector,
		select,
		toggle,
	};
}

// @vitest-environment jsdom

import type { WalletConnector } from '@solana/client';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockSolanaClient } from '../test/mocks';
import { useConnectWallet, useWallet } from './hooks';
import { SolanaProvider } from './SolanaProvider';

const PHANTOM_CONNECTOR: WalletConnector = {
	canAutoConnect: true,
	connect: vi.fn(),
	disconnect: vi.fn(),
	id: 'phantom',
	isSupported: () => true,
	name: 'Phantom',
};

vi.mock('./hooks', async () => {
	const actual = await vi.importActual<typeof import('./hooks')>('./hooks');
	return {
		...actual,
		useConnectWallet: vi.fn(),
		useWallet: vi.fn(),
	};
});

const useWalletMock = useWallet as unknown as vi.Mock;
const useConnectWalletMock = useConnectWallet as unknown as vi.Mock;

describe('SolanaProvider wallet persistence', () => {
	beforeEach(() => {
		useWalletMock.mockReset();
		useConnectWalletMock.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('persists the connector identifier when the wallet is connected', async () => {
		const storage = createStorage();
		useWalletMock.mockReturnValue({
			connectorId: 'phantom',
			session: {},
			status: 'connected',
		});
		useConnectWalletMock.mockReturnValue(vi.fn());

		render(
			<SolanaProvider
				client={createMockSolanaClient({ connectors: [PHANTOM_CONNECTOR] })}
				query={false}
				walletPersistence={{ storage }}
			>
				<div />
			</SolanaProvider>,
		);

		await waitFor(() => expect(storage.setItem).toHaveBeenCalledWith('solana:last-connector', 'phantom'));
		expect(storage.removeItem).not.toHaveBeenCalled();
	});

	it('removes persisted state when the wallet disconnects after storing an id', async () => {
		const storage = createStorage();
		useWalletMock
			.mockReturnValueOnce({
				connectorId: 'phantom',
				session: {},
				status: 'connected',
			})
			.mockReturnValue({
				status: 'disconnected',
			});
		useConnectWalletMock.mockReturnValue(vi.fn());

		const { rerender } = render(
			<SolanaProvider
				client={createMockSolanaClient({ connectors: [PHANTOM_CONNECTOR] })}
				query={false}
				walletPersistence={{ storage }}
			>
				<div />
			</SolanaProvider>,
		);

		await waitFor(() => expect(storage.setItem).toHaveBeenCalledWith('solana:last-connector', 'phantom'));
		rerender(
			<SolanaProvider
				client={createMockSolanaClient({ connectors: [PHANTOM_CONNECTOR] })}
				query={false}
				walletPersistence={{ storage }}
			>
				<div />
			</SolanaProvider>,
		);

		await waitFor(() => expect(storage.removeItem).toHaveBeenCalledWith('solana:last-connector'));
		expect(storage.setItem).toHaveBeenCalledTimes(1);
	});

	it('auto-connects using the stored connector identifier by default', async () => {
		const storage = createStorage();
		storage.getItem.mockReturnValue('phantom');
		const connect = vi.fn().mockResolvedValue(undefined);
		useConnectWalletMock.mockReturnValue(connect);
		useWalletMock.mockReturnValue({
			status: 'disconnected',
		});

		render(
			<SolanaProvider
				client={createMockSolanaClient({ connectors: [PHANTOM_CONNECTOR] })}
				query={false}
				walletPersistence={{ storage }}
			>
				<div />
			</SolanaProvider>,
		);

		await waitFor(() => expect(connect).toHaveBeenCalledWith('phantom', { autoConnect: true }));
	});

	it('retries auto-connect when a new client with registered connectors is provided', async () => {
		const storage = createStorage();
		storage.getItem.mockReturnValue('phantom');
		const connect = vi.fn().mockResolvedValue(undefined);
		useConnectWalletMock.mockReturnValue(connect);
		useWalletMock.mockReturnValue({
			status: 'disconnected',
		});

		const initialClient = createMockSolanaClient({ connectors: [] });
		const nextClient = createMockSolanaClient({ connectors: [PHANTOM_CONNECTOR] });

		const { rerender } = render(
			<SolanaProvider client={initialClient} query={false} walletPersistence={{ storage }}>
				<div />
			</SolanaProvider>,
		);

		expect(connect).not.toHaveBeenCalled();

		rerender(
			<SolanaProvider client={nextClient} query={false} walletPersistence={{ storage }}>
				<div />
			</SolanaProvider>,
		);

		await waitFor(() => expect(connect).toHaveBeenCalledWith('phantom', { autoConnect: true }));
	});

	it('skips auto-connect when disabled via configuration', async () => {
		const storage = createStorage();
		storage.getItem.mockReturnValue('phantom');
		const connect = vi.fn();
		useConnectWalletMock.mockReturnValue(connect);
		useWalletMock.mockReturnValue({
			status: 'disconnected',
		});

		render(
			<SolanaProvider
				client={createMockSolanaClient({ connectors: [PHANTOM_CONNECTOR] })}
				query={false}
				walletPersistence={{ autoConnect: false, storage }}
			>
				<div />
			</SolanaProvider>,
		);

		await waitFor(() => expect(connect).not.toHaveBeenCalled());
	});
});

function createStorage() {
	return {
		getItem: vi.fn().mockReturnValue(null),
		removeItem: vi.fn(),
		setItem: vi.fn(),
	};
}

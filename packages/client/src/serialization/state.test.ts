import { describe, expect, it } from 'vitest';

import type { SolanaClientConfig } from '../types';
import { applySerializableState, getInitialSerializableState } from './state';

const baseConfig: SolanaClientConfig = {
	endpoint: 'https://api.devnet.solana.com',
};

describe('serialization state helpers', () => {
	it('derives an initial serializable state from config', () => {
		const state = getInitialSerializableState({
			...baseConfig,
			commitment: 'finalized',
			websocketEndpoint: 'wss://api.devnet.solana.com',
		});

		expect(state).toMatchObject({
			autoconnect: false,
			commitment: 'finalized',
			endpoint: baseConfig.endpoint,
			lastConnectorId: null,
			lastPublicKey: null,
			version: 1,
			websocketEndpoint: 'wss://api.devnet.solana.com',
		});
	});

	it('returns the original config when no state is provided', () => {
		const merged = applySerializableState(baseConfig, null);
		expect(merged).toEqual(baseConfig);
	});

	it('merges persisted state over config when provided', () => {
		const merged = applySerializableState(
			{ ...baseConfig, commitment: 'processed', websocketEndpoint: 'wss://example.com' },
			{
				autoconnect: true,
				commitment: 'confirmed',
				endpoint: 'https://api.mainnet-beta.solana.com',
				lastConnectorId: 'phantom',
				lastPublicKey: 'pubkey',
				version: 1,
			},
		);

		expect(merged).toMatchObject({
			endpoint: 'https://api.mainnet-beta.solana.com',
			commitment: 'confirmed',
			websocketEndpoint: 'wss://example.com',
		});
	});
});

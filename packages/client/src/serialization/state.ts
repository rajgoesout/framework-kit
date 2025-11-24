import type { SerializableSolanaState, SolanaClientConfig } from '../types';

const SERIALIZABLE_STATE_VERSION = 1;

/**
 * Derive the minimal serializable state for a client based on its config.
 */
export function getInitialSerializableState(config: SolanaClientConfig): SerializableSolanaState {
	return {
		autoconnect: false,
		commitment: config.commitment,
		endpoint: config.endpoint,
		lastConnectorId: null,
		lastPublicKey: null,
		version: SERIALIZABLE_STATE_VERSION,
		websocketEndpoint: config.websocketEndpoint,
	};
}

/**
 * Applies persisted serializable state on top of a base client config.
 *
 * This is a pure helper; it does not mutate the client. Callers can use the returned
 * config object to construct a hydrated client instance.
 */
export function applySerializableState(
	config: SolanaClientConfig,
	state: SerializableSolanaState | null | undefined,
): SolanaClientConfig {
	if (!state) {
		return config;
	}
	return {
		...config,
		commitment: state.commitment ?? config.commitment,
		endpoint: state.endpoint ?? config.endpoint,
		websocketEndpoint: state.websocketEndpoint ?? config.websocketEndpoint,
	};
}

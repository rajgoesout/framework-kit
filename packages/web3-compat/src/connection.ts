import { createSolanaRpcClient, type SolanaRpcClient } from '@solana/client-core';
import {
	type AccountInfo,
	type Commitment,
	type ConnectionConfig,
	type DataSlice,
	PublicKey,
	type SendOptions,
	type SignatureStatus,
	type SignatureStatusConfig,
	type SimulatedTransactionResponse,
	type SimulateTransactionConfig,
	Transaction,
	type TransactionSignature,
	VersionedTransaction,
} from '@solana/web3.js';

type NormalizedCommitment = 'processed' | 'confirmed' | 'finalized';

type RpcContext = Readonly<{
	apiVersion?: string;
	slot: number;
}>;

type AccountInfoConfig = Readonly<{
	commitment?: Commitment;
	dataSlice?: DataSlice;
	encoding?: 'base64';
	minContextSlot?: number;
}>;

type ProgramAccountsConfig = Readonly<{
	commitment?: Commitment;
	dataSlice?: DataSlice;
	encoding?: 'base64' | 'base64+zstd';
	filters?: ReadonlyArray<unknown>;
	minContextSlot?: number;
	withContext?: boolean;
}>;

type ConnectionCommitmentInput =
	| Commitment
	| (ConnectionConfig & {
			commitment?: Commitment;
	  })
	| undefined;

type RpcResponseWithContext<T> = Readonly<{
	context: RpcContext;
	value: T;
}>;

type RawTransactionInput = number[] | Uint8Array | Buffer | Transaction | VersionedTransaction;

type RpcAccount = Readonly<{
	data: readonly [string, string] | string;
	executable: boolean;
	lamports: number | bigint;
	owner: string;
	rentEpoch: number | bigint;
}>;

type ProgramAccountWire = Readonly<{
	account: RpcAccount;
	pubkey: string;
}>;

type ProgramAccountsWithContext = Readonly<{
	context: Readonly<{
		apiVersion?: string;
		slot: number | bigint;
	}>;
	value: readonly ProgramAccountWire[];
}>;

const DEFAULT_COMMITMENT: NormalizedCommitment = 'confirmed';

function normalizeCommitment(commitment?: Commitment | null): NormalizedCommitment | undefined {
	if (commitment === undefined || commitment === null) {
		return undefined;
	}
	if (commitment === 'recent') {
		return 'processed';
	}
	if (commitment === 'singleGossip') {
		return 'processed';
	}
	if (commitment === 'single') {
		return 'confirmed';
	}
	if (commitment === 'max') {
		return 'finalized';
	}
	return commitment as NormalizedCommitment;
}

function toBigInt(value: number | bigint | undefined): bigint | undefined {
	if (value === undefined) return undefined;
	return typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
}

function toNumberOrNull(value: bigint | number | null | undefined): number | null | undefined {
	if (value === null || value === undefined) return value;
	return typeof value === 'number' ? value : Number(value);
}

function toAccountInfo(info: RpcAccount): AccountInfo<Buffer> {
	const { data, executable, lamports, owner, rentEpoch } = info;
	const [content, encoding] = Array.isArray(data) ? data : [data, 'base64'];
	const buffer = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content);
	return {
		data: buffer,
		executable,
		lamports: typeof lamports === 'number' ? lamports : Number(lamports),
		owner: new PublicKey(owner),
		rentEpoch: typeof rentEpoch === 'number' ? rentEpoch : Number(rentEpoch),
	};
}

export class Connection {
	readonly commitment?: NormalizedCommitment;
	readonly rpcEndpoint: string;

	#client: SolanaRpcClient;

	constructor(endpoint: string, commitmentOrConfig?: ConnectionCommitmentInput) {
		const commitment =
			typeof commitmentOrConfig === 'string'
				? normalizeCommitment(commitmentOrConfig)
				: (normalizeCommitment(commitmentOrConfig?.commitment) ?? DEFAULT_COMMITMENT);

		const websocketEndpoint =
			typeof commitmentOrConfig === 'object' && commitmentOrConfig !== null
				? commitmentOrConfig.wsEndpoint
				: undefined;

		this.commitment = commitment;
		this.rpcEndpoint = endpoint;
		this.#client = createSolanaRpcClient({
			endpoint,
			websocketEndpoint,
			commitment: commitment ?? DEFAULT_COMMITMENT,
		});
	}

	async getLatestBlockhash(
		commitmentOrConfig?:
			| Commitment
			| {
					commitment?: Commitment;
					maxSupportedTransactionVersion?: number;
					minContextSlot?: number;
			  },
	): Promise<{
		blockhash: string;
		lastValidBlockHeight: number;
	}> {
		const baseCommitment =
			typeof commitmentOrConfig === 'string' ? commitmentOrConfig : commitmentOrConfig?.commitment;
		const commitment = baseCommitment ?? this.commitment ?? DEFAULT_COMMITMENT;
		const minContextSlot =
			typeof commitmentOrConfig === 'object' ? toBigInt(commitmentOrConfig.minContextSlot) : undefined;
		const maxSupportedTransactionVersion =
			typeof commitmentOrConfig === 'object' ? commitmentOrConfig.maxSupportedTransactionVersion : undefined;
		const response = await this.#client.rpc
			.getLatestBlockhash({
				commitment,
				maxSupportedTransactionVersion,
				minContextSlot,
			})
			.send();

		return {
			blockhash: response.value.blockhash,
			lastValidBlockHeight: Number(response.value.lastValidBlockHeight),
		};
	}

	async getBalance(publicKey: PublicKey | string, commitment?: Commitment): Promise<number> {
		const address = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
		const chosenCommitment = commitment ?? this.commitment ?? DEFAULT_COMMITMENT;
		const result = await this.#client.rpc.getBalance(address, { commitment: chosenCommitment }).send();
		return typeof result.value === 'number' ? result.value : Number(result.value);
	}

	async getAccountInfo<TAccountData = Buffer>(
		publicKey: PublicKey | string,
		commitmentOrConfig?: AccountInfoConfig | Commitment,
	): Promise<AccountInfo<TAccountData> | null> {
		const address = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
		let commitment: Commitment | undefined;
		let minContextSlot: bigint | undefined;
		let dataSlice: DataSlice | undefined;
		let encoding: 'base64' | undefined;
		if (typeof commitmentOrConfig === 'string') {
			commitment = commitmentOrConfig;
		} else if (commitmentOrConfig) {
			commitment = commitmentOrConfig.commitment;
			if (commitmentOrConfig.minContextSlot !== undefined) {
				minContextSlot = toBigInt(commitmentOrConfig.minContextSlot);
			}
			dataSlice = commitmentOrConfig.dataSlice;
			encoding = commitmentOrConfig.encoding;
		}

		const response = await this.#client.rpc
			.getAccountInfo(address, {
				commitment: commitment ?? this.commitment ?? DEFAULT_COMMITMENT,
				dataSlice,
				encoding,
				minContextSlot,
			})
			.send();

		if (!response.value) {
			return null;
		}
		const accountInfo = toAccountInfo(response.value);

		return accountInfo as AccountInfo<TAccountData>;
	}

	async getProgramAccounts(
		programId: PublicKey | string,
		commitmentOrConfig?: Commitment | ProgramAccountsConfig,
	): Promise<
		| Array<{
				account: AccountInfo<Buffer | object>;
				pubkey: PublicKey;
		  }>
		| RpcResponseWithContext<
				Array<{
					account: AccountInfo<Buffer | object>;
					pubkey: PublicKey;
				}>
		  >
	> {
		const id = typeof programId === 'string' ? programId : programId.toBase58();
		let commitment: Commitment | undefined;
		let dataSlice: DataSlice | undefined;
		let filters: ReadonlyArray<unknown> | undefined;
		let encoding: 'base64' | 'base64+zstd' | undefined;
		let minContextSlot: bigint | undefined;
		let withContext = false;
		if (typeof commitmentOrConfig === 'string') {
			commitment = commitmentOrConfig;
		} else if (commitmentOrConfig) {
			commitment = commitmentOrConfig.commitment;
			dataSlice = commitmentOrConfig.dataSlice;
			filters = commitmentOrConfig.filters;
			encoding = commitmentOrConfig.encoding;
			minContextSlot = toBigInt(commitmentOrConfig.minContextSlot);
			withContext = Boolean(commitmentOrConfig.withContext);
		}

		const result = await this.#client.rpc
			.getProgramAccounts(id, {
				commitment: commitment ?? this.commitment ?? DEFAULT_COMMITMENT,
				dataSlice,
				encoding,
				filters,
				minContextSlot,
				withContext,
			})
			.send();

		const mapProgramAccount = (entry: ProgramAccountWire) => {
			const pubkey = new PublicKey(entry.pubkey);
			return {
				account: toAccountInfo(entry.account),
				pubkey,
			};
		};

		if (withContext && typeof (result as ProgramAccountsWithContext).context !== 'undefined') {
			const contextual = result as ProgramAccountsWithContext;
			return {
				context: {
					apiVersion: contextual.context.apiVersion,
					slot: Number(contextual.context.slot),
				},
				value: contextual.value.map(mapProgramAccount),
			};
		}

		return (result as readonly ProgramAccountWire[]).map(mapProgramAccount);
	}

	async getSignatureStatuses(
		signatures: readonly TransactionSignature[],
		config?: SignatureStatusConfig,
	): Promise<RpcResponseWithContext<(SignatureStatus | null)[]>> {
		const response = await this.#client.rpc
			.getSignatureStatuses(signatures, {
				commitment: config?.commitment ?? this.commitment ?? DEFAULT_COMMITMENT,
				searchTransactionHistory: config?.searchTransactionHistory,
			})
			.send();

		const normalizedContext: RpcContext = {
			apiVersion: response.context.apiVersion,
			slot: Number(response.context.slot),
		};

		const normalizedValues = response.value.map((status: SignatureStatus | null) => {
			if (!status) {
				return null;
			}
			return {
				...status,
				confirmations: toNumberOrNull(status.confirmations),
				slot: Number(status.slot),
			};
		});

		return {
			context: normalizedContext,
			value: normalizedValues,
		};
	}

	async sendRawTransaction(rawTransaction: RawTransactionInput, options?: SendOptions): Promise<string> {
		const bytes = this.#compileRawTransaction(rawTransaction);
		const encoded = Buffer.from(bytes).toString('base64');

		const preflightCommitment =
			options?.preflightCommitment ?? options?.commitment ?? this.commitment ?? DEFAULT_COMMITMENT;
		const maxRetries = options?.maxRetries === undefined ? undefined : toBigInt(options.maxRetries);
		const minContextSlot = options?.minContextSlot === undefined ? undefined : toBigInt(options.minContextSlot);
		const plan = this.#client.rpc.sendTransaction(encoded, {
			encoding: 'base64',
			maxRetries,
			minContextSlot,
			preflightCommitment,
			skipPreflight: options?.skipPreflight,
		});

		return await plan.send();
	}

	async confirmTransaction(
		signature: TransactionSignature,
		commitment?: Commitment,
	): Promise<RpcResponseWithContext<SignatureStatus | null>> {
		const response = await this.getSignatureStatuses([signature], {
			commitment: commitment ?? this.commitment ?? DEFAULT_COMMITMENT,
			searchTransactionHistory: true,
		});

		return {
			context: response.context,
			value: response.value[0] ?? null,
		};
	}

	async simulateTransaction(
		transaction: RawTransactionInput,
		config?: SimulateTransactionConfig,
	): Promise<RpcResponseWithContext<SimulatedTransactionResponse>> {
		const bytes = this.#compileRawTransaction(transaction);
		const encoded = Buffer.from(bytes).toString('base64');
		const commitment = config?.commitment ?? this.commitment ?? DEFAULT_COMMITMENT;

		const response = await this.#client.rpc
			.simulateTransaction(encoded, {
				...config,
				commitment,
				encoding: 'base64',
			})
			.send();

		return {
			context: {
				apiVersion: response.context.apiVersion,
				slot: Number(response.context.slot),
			},
			value: response.value,
		};
	}

	#compileRawTransaction(raw: RawTransactionInput): Uint8Array {
		if (raw instanceof Transaction) {
			return raw.serialize({ requireAllSignatures: false });
		}
		if (raw instanceof VersionedTransaction) {
			return raw.serialize();
		}
		if (Array.isArray(raw)) {
			return Uint8Array.from(raw);
		}
		return raw instanceof Uint8Array ? raw : Uint8Array.from(raw);
	}
}

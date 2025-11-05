import { address, type Address } from '@solana/addresses';
import { ReadonlyUint8Array } from '@solana/codecs-core';
import { SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED, SolanaError } from '@solana/errors';
import { SignatureBytes } from '@solana/keys';
import { getAbortablePromise } from '@solana/promises';
import type { MessageModifyingSigner, SignableMessage, TransactionModifyingSigner, TransactionSendingSigner } from '@solana/signers';
import { getCompiledTransactionMessageDecoder } from '@solana/transaction-messages';
import {
    Transaction,
    TransactionWithinSizeLimit,
    TransactionWithLifetime,
    assertIsTransactionWithinSizeLimit,
    getTransactionCodec,
    getTransactionEncoder,
    getTransactionLifetimeConstraintFromCompiledTransactionMessage,
} from '@solana/transactions';
import {
    SolanaSignAndSendTransaction,
    type SolanaSignAndSendTransactionFeature,
    type SolanaSignAndSendTransactionInput,
    type SolanaSignAndSendTransactionOutput,
    SolanaSignIn,
    type SolanaSignInFeature,
    type SolanaSignInInput,
    type SolanaSignInOutput,
    SolanaSignMessage,
    type SolanaSignMessageFeature,
    type SolanaSignMessageInput,
    type SolanaSignMessageOutput,
    SolanaSignTransaction,
    type SolanaSignTransactionFeature,
    type SolanaSignTransactionInput,
    type SolanaSignTransactionOutput,
} from '@solana/wallet-standard-features';
import {
    WALLET_STANDARD_ERROR__FEATURES__WALLET_ACCOUNT_CHAIN_UNSUPPORTED,
    WalletStandardError,
} from '@wallet-standard/errors';
import type { IdentifierArray } from '@wallet-standard/base';
import {
    getWalletAccountFeature,
    getWalletFeature,
    type UiWallet,
    type UiWalletAccount,
    type UiWalletHandle,
} from '@wallet-standard/ui';
import {
    getOrCreateUiWalletAccountForStandardWalletAccount_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
    getWalletAccountForUiWalletAccount_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
    getWalletForHandle_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
} from '@wallet-standard/ui-registry';
import { useCallback, useMemo, useRef } from 'react';

type AssertSolanaChain<T> = T extends `solana:${string}` ? T : never;

/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export type OnlySolanaChains<T extends IdentifierArray> = T extends IdentifierArray
    ? AssertSolanaChain<T[number]>
    : never;

type SignAndSendInput = Readonly<
    Omit<SolanaSignAndSendTransactionInput, 'account' | 'chain' | 'options'> & {
        options?: Readonly<{
            minContextSlot?: bigint;
        }>;
    }
>;
type SignAndSendOutput = SolanaSignAndSendTransactionOutput;

/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useSignAndSendTransaction<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: OnlySolanaChains<TWalletAccount['chains']>,
): (input: SignAndSendInput) => Promise<SignAndSendOutput>;
/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useSignAndSendTransaction<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): (input: SignAndSendInput) => Promise<SignAndSendOutput>;
export function useSignAndSendTransaction<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): (input: SignAndSendInput) => Promise<SignAndSendOutput> {
    const signAndSendTransactions = useSignAndSendTransactions(uiWalletAccount, chain);
    return useCallback(
        async input => {
            const [result] = await signAndSendTransactions(input);
            return result;
        },
        [signAndSendTransactions],
    );
}

function useSignAndSendTransactions<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): (...inputs: readonly SignAndSendInput[]) => Promise<readonly SignAndSendOutput[]> {
    if (!uiWalletAccount.chains.includes(chain)) {
        throw new WalletStandardError(WALLET_STANDARD_ERROR__FEATURES__WALLET_ACCOUNT_CHAIN_UNSUPPORTED, {
            address: uiWalletAccount.address,
            chain,
            featureName: SolanaSignAndSendTransaction,
            supportedChains: [...uiWalletAccount.chains],
            supportedFeatures: [...uiWalletAccount.features],
        });
    }
    const signAndSendTransactionFeature = getWalletAccountFeature(
        uiWalletAccount,
        SolanaSignAndSendTransaction,
    ) as SolanaSignAndSendTransactionFeature[typeof SolanaSignAndSendTransaction];
    const account = getWalletAccountForUiWalletAccount_DO_NOT_USE_OR_YOU_WILL_BE_FIRED(uiWalletAccount);
    return useCallback(
        async (...inputs) => {
            const inputsWithChainAndAccount = inputs.map(({ options, ...rest }) => {
                const minContextSlot = options?.minContextSlot;
                return {
                    ...rest,
                    account,
                    chain,
                    ...(minContextSlot != null
                        ? {
                              options: {
                                  minContextSlot: Number(minContextSlot),
                              },
                          }
                        : null),
                };
            });
            const results = await signAndSendTransactionFeature.signAndSendTransaction(...inputsWithChainAndAccount);
            return results;
        },
        [account, chain, signAndSendTransactionFeature],
    );
}

type SignInInput = SolanaSignInInput;
type SignInOutput = Omit<SolanaSignInOutput, 'account' | 'signatureType'> &
    Readonly<{
        account: UiWalletAccount;
    }>;

/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useSignIn(uiWalletAccount: UiWalletAccount): (input?: Omit<SignInInput, 'address'>) => Promise<SignInOutput>;
/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useSignIn(uiWallet: UiWallet): (input?: SignInInput) => Promise<SignInOutput>;
export function useSignIn(uiWalletHandle: UiWalletHandle): (input?: SignInInput) => Promise<SignInOutput> {
    const signIns = useSignIns(uiWalletHandle);
    return useCallback(
        async input => {
            const [result] = await signIns(input);
            return result;
        },
        [signIns],
    );
}

function useSignIns(
    uiWalletHandle: UiWalletHandle,
): (...inputs: readonly (SignInInput | undefined)[]) => Promise<readonly SignInOutput[]> {
    let signMessageFeature: SolanaSignInFeature[typeof SolanaSignIn];
    if ('address' in uiWalletHandle && typeof uiWalletHandle.address === 'string') {
        getWalletAccountForUiWalletAccount_DO_NOT_USE_OR_YOU_WILL_BE_FIRED(uiWalletHandle as UiWalletAccount);
        signMessageFeature = getWalletAccountFeature(
            uiWalletHandle as UiWalletAccount,
            SolanaSignIn,
        ) as SolanaSignInFeature[typeof SolanaSignIn];
    } else {
        signMessageFeature = getWalletFeature(uiWalletHandle, SolanaSignIn) as SolanaSignInFeature[typeof SolanaSignIn];
    }
    const wallet = getWalletForHandle_DO_NOT_USE_OR_YOU_WILL_BE_FIRED(uiWalletHandle);
    return useCallback(
        async (...inputs) => {
            const inputsWithAddressAndChainId = inputs.map(input => ({
                ...input,
                // Prioritize the `UiWalletAccount` address if it exists.
                ...('address' in uiWalletHandle ? { address: uiWalletHandle.address as Address } : null),
            }));
            const results = await signMessageFeature.signIn(...inputsWithAddressAndChainId);
            const resultsWithoutSignatureType = results.map(
                ({
                    account,
                    signatureType: _signatureType, // Solana signatures are always of type `ed25519` so drop this property.
                    ...rest
                }) => ({
                    ...rest,
                    account: getOrCreateUiWalletAccountForStandardWalletAccount_DO_NOT_USE_OR_YOU_WILL_BE_FIRED(
                        wallet,
                        account,
                    ),
                }),
            );
            return resultsWithoutSignatureType;
        },
        [signMessageFeature, uiWalletHandle, wallet],
    );
}

type SignMessageInput = Omit<SolanaSignMessageInput, 'account'>;
type SignMessageOutput = Omit<SolanaSignMessageOutput, 'signatureType'>;

/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useSignMessage<TWalletAccount extends UiWalletAccount>(
    ...config: Parameters<typeof useSignMessages<TWalletAccount>>
): (input: SignMessageInput) => Promise<SignMessageOutput> {
    const signMessages = useSignMessages(...config);
    return useCallback(
        async input => {
            const [result] = await signMessages(input);
            return result;
        },
        [signMessages],
    );
}

function useSignMessages<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
): (...inputs: readonly SignMessageInput[]) => Promise<readonly SignMessageOutput[]> {
    const signMessageFeature = getWalletAccountFeature(
        uiWalletAccount,
        SolanaSignMessage,
    ) as SolanaSignMessageFeature[typeof SolanaSignMessage];
    const account = getWalletAccountForUiWalletAccount_DO_NOT_USE_OR_YOU_WILL_BE_FIRED(uiWalletAccount);
    return useCallback(
        async (...inputs) => {
            const inputsWithAccount = inputs.map(input => ({ ...input, account }));
            const results = await signMessageFeature.signMessage(...inputsWithAccount);
            const resultsWithoutSignatureType = results.map(
                ({
                    signatureType: _signatureType, // Solana signatures are always of type `ed25519` so drop this property.
                    ...rest
                }) => rest,
            );
            return resultsWithoutSignatureType;
        },
        [signMessageFeature, account],
    );
}

type SignTransactionInput = Readonly<
    Omit<SolanaSignTransactionInput, 'account' | 'chain' | 'options'> & {
        options?: Readonly<{
            minContextSlot?: bigint;
        }>;
    }
>;
type SignTransactionOutput = SolanaSignTransactionOutput;

/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useSignTransaction<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: OnlySolanaChains<TWalletAccount['chains']>,
): (input: SignTransactionInput) => Promise<SignTransactionOutput>;
/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useSignTransaction<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): (input: SignTransactionInput) => Promise<SignTransactionOutput>;
export function useSignTransaction<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): (input: SignTransactionInput) => Promise<SignTransactionOutput> {
    const signTransactions = useSignTransactions(uiWalletAccount, chain);
    return useCallback(
        async input => {
            const [result] = await signTransactions(input);
            return result;
        },
        [signTransactions],
    );
}

function useSignTransactions<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): (...inputs: readonly SignTransactionInput[]) => Promise<readonly SignTransactionOutput[]> {
    if (!uiWalletAccount.chains.includes(chain)) {
        throw new WalletStandardError(WALLET_STANDARD_ERROR__FEATURES__WALLET_ACCOUNT_CHAIN_UNSUPPORTED, {
            address: uiWalletAccount.address,
            chain,
            featureName: SolanaSignAndSendTransaction,
            supportedChains: [...uiWalletAccount.chains],
            supportedFeatures: [...uiWalletAccount.features],
        });
    }
    const signTransactionFeature = getWalletAccountFeature(
        uiWalletAccount,
        SolanaSignTransaction,
    ) as SolanaSignTransactionFeature[typeof SolanaSignTransaction];
    const account = getWalletAccountForUiWalletAccount_DO_NOT_USE_OR_YOU_WILL_BE_FIRED(uiWalletAccount);
    return useCallback(
        async (...inputs) => {
            const inputsWithAccountAndChain = inputs.map(({ options, ...rest }) => {
                const minContextSlot = options?.minContextSlot;
                return {
                    ...rest,
                    account,
                    chain,
                    ...(minContextSlot != null
                        ? {
                              options: {
                                  minContextSlot: Number(minContextSlot),
                              },
                          }
                        : null),
                };
            });
            const results = await signTransactionFeature.signTransaction(...inputsWithAccountAndChain);
            return results;
        },
        [signTransactionFeature, account, chain],
    );
}

/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useWalletAccountMessageSigner<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
): MessageModifyingSigner<TWalletAccount['address']> {
    const signMessage = useSignMessage(uiWalletAccount);
    return useMemo(
        () => ({
            address: address(uiWalletAccount.address),
            async modifyAndSignMessages(messages, config) {
                config?.abortSignal?.throwIfAborted();
                if (messages.length > 1) {
                    throw new SolanaError(SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED);
                }
                if (messages.length === 0) {
                    return messages;
                }
                const { content: originalMessage, signatures: originalSignatureMap } = messages[0];
                const input = {
                    message: originalMessage,
                };
                const { signedMessage, signature } = await getAbortablePromise(signMessage(input), config?.abortSignal);
                const messageWasModified =
                    originalMessage.length !== signedMessage.length ||
                    originalMessage.some((originalByte, ii) => originalByte !== signedMessage[ii]);
                const originalSignature = originalSignatureMap[uiWalletAccount.address as Address<string>] as
                    | SignatureBytes
                    | undefined;
                const signatureIsNew = !originalSignature?.every((originalByte, ii) => originalByte === signature[ii]);
                if (!signatureIsNew && !messageWasModified) {
                    return messages;
                }
                const nextSignatureMap = messageWasModified
                    ? { [uiWalletAccount.address]: signature }
                    : { ...originalSignatureMap, [uiWalletAccount.address]: signature };
                const outputMessages = Object.freeze([
                    Object.freeze({
                        content: signedMessage,
                        signatures: Object.freeze(nextSignatureMap),
                    }) as SignableMessage,
                ]);
                return outputMessages;
            },
        }),
        [uiWalletAccount, signMessage],
    );
}

/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useWalletAccountTransactionSigner<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: OnlySolanaChains<TWalletAccount['chains']>,
): TransactionModifyingSigner<TWalletAccount['address']>;
/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useWalletAccountTransactionSigner<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): TransactionModifyingSigner<TWalletAccount['address']>;
export function useWalletAccountTransactionSigner<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): TransactionModifyingSigner<TWalletAccount['address']> {
    const encoderRef = useRef<ReturnType<typeof getTransactionCodec> | null>(null);
    const signTransaction = useSignTransaction(uiWalletAccount, chain);
    return useMemo(
        () => ({
            address: address(uiWalletAccount.address),
            async modifyAndSignTransactions(transactions, config = {}) {
                const { abortSignal, ...options } = config;
                abortSignal?.throwIfAborted();
                const transactionCodec = (encoderRef.current ||= getTransactionCodec());
                if (transactions.length > 1) {
                    throw new SolanaError(SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED);
                }
                if (transactions.length === 0) {
                    return transactions as readonly (Transaction &
                        TransactionWithinSizeLimit &
                        TransactionWithLifetime)[];
                }
                const [transaction] = transactions;
                const wireTransactionBytes = transactionCodec.encode(transaction);
                const inputWithOptions = {
                    ...options,
                    transaction: wireTransactionBytes as Uint8Array,
                };
                const { signedTransaction } = await getAbortablePromise(signTransaction(inputWithOptions), abortSignal);
                const decodedSignedTransaction = transactionCodec.decode(
                    signedTransaction,
                ) as (typeof transactions)[number];

                assertIsTransactionWithinSizeLimit(decodedSignedTransaction);

                const existingLifetime =
                    'lifetimeConstraint' in transaction
                        ? (transaction as TransactionWithLifetime).lifetimeConstraint
                        : undefined;

                if (existingLifetime) {
                    if (uint8ArraysEqual(decodedSignedTransaction.messageBytes, transaction.messageBytes)) {
                        return Object.freeze([
                            {
                                ...decodedSignedTransaction,
                                lifetimeConstraint: existingLifetime,
                            },
                        ]);
                    }

                    const compiledTransactionMessage = getCompiledTransactionMessageDecoder().decode(
                        decodedSignedTransaction.messageBytes,
                    );
                    const currentToken =
                        'blockhash' in existingLifetime ? existingLifetime.blockhash : existingLifetime.nonce;

                    if (compiledTransactionMessage.lifetimeToken === currentToken) {
                        return Object.freeze([
                            {
                                ...decodedSignedTransaction,
                                lifetimeConstraint: existingLifetime,
                            },
                        ]);
                    }
                }

                const compiledTransactionMessage = getCompiledTransactionMessageDecoder().decode(
                    decodedSignedTransaction.messageBytes,
                );
                const lifetimeConstraint =
                    await getTransactionLifetimeConstraintFromCompiledTransactionMessage(compiledTransactionMessage);
                return Object.freeze([
                    {
                        ...decodedSignedTransaction,
                        lifetimeConstraint,
                    },
                ]);
            },
        }),
        [uiWalletAccount.address, signTransaction],
    );
}

function uint8ArraysEqual(arr1: ReadonlyUint8Array, arr2: ReadonlyUint8Array) {
    return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useWalletAccountTransactionSendingSigner<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: OnlySolanaChains<TWalletAccount['chains']>,
): TransactionSendingSigner<TWalletAccount['address']>;
/**
 * @deprecated Use `@solana/react` for Wallet Standard hooks; this shim will be removed in a future release.
 */
export function useWalletAccountTransactionSendingSigner<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): TransactionSendingSigner<TWalletAccount['address']>;
export function useWalletAccountTransactionSendingSigner<TWalletAccount extends UiWalletAccount>(
    uiWalletAccount: TWalletAccount,
    chain: `solana:${string}`,
): TransactionSendingSigner<TWalletAccount['address']> {
    const encoderRef = useRef<ReturnType<typeof getTransactionEncoder> | null>(null);
    const signAndSendTransaction = useSignAndSendTransaction(uiWalletAccount, chain);
    return useMemo(
        () => ({
            address: address(uiWalletAccount.address),
            async signAndSendTransactions(transactions, config = {}) {
                const { abortSignal, ...options } = config;
                abortSignal?.throwIfAborted();
                const transactionEncoder = (encoderRef.current ||= getTransactionEncoder());
                if (transactions.length > 1) {
                    throw new SolanaError(SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED);
                }
                if (transactions.length === 0) {
                    return [];
                }
                const [transaction] = transactions;
                const wireTransactionBytes = transactionEncoder.encode(transaction);
                const inputWithOptions = {
                    ...options,
                    transaction: wireTransactionBytes as Uint8Array,
                };
                const { signature } = await getAbortablePromise(signAndSendTransaction(inputWithOptions), abortSignal);
                return Object.freeze([signature as SignatureBytes]);
            },
        }),
        [signAndSendTransaction, uiWalletAccount.address],
    );
}

# @solana/react-hooks

React hooks for `@solana/client-core`. Drop in the provider and call hooks instead of juggling RPC
clients, wallets, and stores yourself.

> **Status:** Experimental – breaking changes may land often.

## Install

```bash
pnpm add @solana/react-hooks
```

## Minimal example

Mount the provider once and call hooks anywhere in the subtree.

```tsx
import {
    SolanaClientProvider,
    useBalance,
    useConnectWallet,
    useWallet,
} from '@solana/react-hooks';

function WalletButton() {
    const connectWallet = useConnectWallet();
    return <button onClick={() => connectWallet('phantom')}>Connect Phantom</button>;
}

function WalletBalance() {
    const wallet = useWallet();
    const balance = useBalance(wallet.status === 'connected' ? wallet.session.account.address : undefined);

    if (wallet.status !== 'connected') return <p>Connect a wallet</p>;
    if (balance.fetching) return <p>Loading…</p>;

    return <p>Lamports: {balance.lamports?.toString() ?? '0'}</p>;
}

export function App() {
    return (
        <SolanaClientProvider
            config={{
                endpoint: 'https://api.devnet.solana.com',
                websocketEndpoint: 'wss://api.devnet.solana.com',
            }}
        >
            <WalletButton />
            <WalletBalance />
        </SolanaClientProvider>
    );
}
```

## Hooks at a glance

- `useWallet`, `useConnectWallet`, `useDisconnectWallet` – read or update the current wallet session.
- `useBalance` / `useAccount` – fetch lamports once or keep account data in sync.
- `useSolTransfer`, `useSplToken`, `useTransactionPool` – helper-driven flows for SOL, SPL, and
  general transactions.
- `useClientStore` – access the underlying Zustand store if you need low-level state.

### Wallet helpers

Read the current wallet session and expose connect/disconnect buttons.

```tsx
const WalletActions = () => {
    const wallet = useWallet();
    const connect = useConnectWallet();
    const disconnect = useDisconnectWallet();

    if (wallet.status === 'connected') {
        return (
            <div>
                <p>{wallet.session.account.address.toString()}</p>
                <button onClick={() => disconnect()}>Disconnect</button>
            </div>
        );
    }

    return <button onClick={() => connect('phantom')}>Connect Phantom</button>;
};
```

### SOL transfers

Trigger SOL transfers with built-in status tracking.

```tsx
import { useSolTransfer } from '@solana/react-hooks';

const SendSolButton = ({ destination, amount }) => {
    const { send, isSending } = useSolTransfer();

    return (
        <button
            disabled={isSending}
            onClick={() =>
                send({
                    destination,
                    lamports: amount,
                })
            }
        >
            {isSending ? 'Sending…' : 'Send SOL'}
        </button>
    );
};
```

### SPL tokens

Scope SPL helpers by mint and reuse the same API for balances and transfers.

```tsx
const SplBalance = ({ mint }) => {
    const { balance, send, isSending } = useSplToken(mint);

    return (
        <div>
            <p>Amount: {balance?.uiAmount ?? '0'}</p>
            <button
                disabled={isSending}
                onClick={() =>
                    send({
                        amount: 1n,
                        destinationOwner: 'Destination111111111111111111111111',
                    })
                }
            >
                Send 1 token
            </button>
        </div>
    );
};
```

### Transaction pool

Compose instructions, refresh blockhashes automatically, and send transactions from one hook.

```tsx
import type { TransactionInstructionInput } from '@solana/client-core';

const useMemoizedInstruction = (): TransactionInstructionInput => ({
    accounts: [],
    data: new Uint8Array(),
    programAddress: 'Example1111111111111111111111111111111111',
});

const TransactionFlow = () => {
    const instruction = useMemoizedInstruction();
    const {
        addInstruction,
        prepareAndSend,
        sendStatus,
        latestBlockhash,
    } = useTransactionPool();

    return (
        <div>
            <button onClick={() => addInstruction(instruction)}>Add instruction</button>
            <button disabled={sendStatus === 'loading'} onClick={() => prepareAndSend()}>
                {sendStatus === 'loading' ? 'Sending…' : 'Prepare & Send'}
            </button>
            <p>Recent blockhash: {latestBlockhash.blockhash ?? 'loading…'}</p>
        </div>
    );
};
```

### Client store access

Drop down to the underlying Zustand store when you need bespoke selectors.

```tsx
import { useClientStore } from '@solana/react-hooks';

function ClusterStatus() {
    const cluster = useClientStore((state) => state.cluster);
    return <p>Cluster: {cluster.status.status}</p>;
}
```

## Query hooks

Wrap a subtree with `<SolanaQueryProvider>` and call hooks like `useLatestBlockhash`,
`useProgramAccounts`, or `useSimulateTransaction`. Every hook returns `{ data, status, refresh }` so
you can read the current value and trigger a refetch:

```tsx
import { SolanaQueryProvider, useProgramAccounts } from '@solana/react-hooks';

function ProgramAccountsList({ programAddress }) {
    const { data, status, refresh } = useProgramAccounts(programAddress);

    if (status === 'loading') return <p>Loading…</p>;
    if (status === 'error') return <p>Retry later.</p>;

    return (
        <div>
            <button onClick={() => refresh()}>Refresh</button>
            <ul>
                {data?.map(({ pubkey }) => (
                    <li key={pubkey.toString()}>{pubkey.toString()}</li>
                ))}
            </ul>
        </div>
    );
}

export function QueryDemo({ programAddress }) {
    return (
        <SolanaClientProvider config={{ endpoint: 'https://api.devnet.solana.com' }}>
            <SolanaQueryProvider>
                <ProgramAccountsList programAddress={programAddress} />
            </SolanaQueryProvider>
        </SolanaClientProvider>
    );
}
```

## Going further

- Need Wallet Standard buttons or sign/send helpers? Use `useSignIn`, `useSignMessage`,
  `useSignTransaction`, and friends from `walletStandardHooks.ts`.
- Looking for examples? See `examples/react-hooks` for a ready-to-run playground that wires the
  provider, hooks, and mock UIs together.

## Scripts

- `pnpm build` – run both JS compilation and type definition emit
- `pnpm test:typecheck` – strict type-checking without emit
- `pnpm lint` / `pnpm format` – Biome-powered linting and formatting

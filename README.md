# solana-react

React-focused tooling for building Solana applications. This workspace currently ships two packages:

| Package | Description |
| --- | --- |
| [`@solana/react-hooks`](packages/react-hooks) | React bindings over the headless [`@solana/client-core`](../client-core) SDK. Supplies context providers plus hooks for wallet management, balances, transfers, and SPL helpers. |
| [`@solana/example-react-hooks`](examples/react-hooks) | Tailwind/Vite demo application showcasing the hooks with a polished UI. Handy as a reference or quick-start template. |

---

## `@solana/react-hooks`

React glue around the client-core SDK. You either hand it a `SolanaClient` instance or a config object and the provider wires everything together. Hooks expose cluster and wallet state in a React-friendly way so you can focus on UI.

### Install

```bash
# using pnpm
pnpm add @solana/react-hooks @solana/client-core react react-dom

# or npm
npm install @solana/react-hooks @solana/client-core react react-dom
```

### Quick start

```tsx
import type { SolanaClientConfig } from '@solana/client-core';
import {
    SolanaClientProvider,
    useConnectWallet,
    useDisconnectWallet,
    useWallet,
    useWalletStandardConnectors,
} from '@solana/react-hooks';

const config: SolanaClientConfig = {
    commitment: 'confirmed',
    endpoint: 'https://api.devnet.solana.com',
};

function WalletButtons() {
    const wallet = useWallet();
    const connectors = useWalletStandardConnectors();
    const connect = useConnectWallet();
    const disconnect = useDisconnectWallet();

    return (
        <div>
            {connectors.map(connector => (
                <button
                    key={connector.id}
                    onClick={() => connect(connector.id)}
                    disabled={wallet.status === 'connecting'}
                >
                    {connector.name}
                </button>
            ))}
            {wallet.status === 'connected' ? (
                <button onClick={() => disconnect()}>Disconnect</button>
            ) : null}
        </div>
    );
}

export function App() {
    return (
        <SolanaClientProvider config={config}>
            <WalletButtons />
        </SolanaClientProvider>
    );
}
```

### Popular hooks

- `useClusterState`, `useClusterStatus`: check RPC/WebSocket connectivity and latency.
- `useWallet`, `useWalletSession`, `useConnectWallet`, `useDisconnectWallet`: Wallet Standard lifecycle helpers.
- `useSolTransfer`, `useSplToken`: SOL and SPL transfer helpers with status + error tracking.
- `useBalance`, `useAccount`: live cache reads from the client store.
- `useTransactionPool`: construct, sign, and send transactions using the built-in helper.
- `useWalletStandardConnectors`: auto-discover Wallet Standard providers at runtime.

> The package also exports deprecated compatibility hooks (`useSignTransaction`, `useSignMessage`, etc.) mirroring the API from `@solana/react`. They exist for easy upgrades but you should prefer the new client-centric helpers.

### Provider options

`SolanaClientProvider` accepts either:

```tsx
<SolanaClientProvider config={config}>...</SolanaClientProvider>
```

or a client instance you manage:

```tsx
const client = createClient(config);

<SolanaClientProvider client={client}>
    <App />
</SolanaClientProvider>
```

Internally created clients are destroyed when the provider unmounts.

---

## `@solana/example-react-hooks`

A Vite + React + Tailwind playground that implements common flows using the hooks library. It mirrors the visual style of the anchor-kit demo and is great for copy/paste snippets.

### Develop

```bash
# using pnpm
pnpm install
pnpm --filter @solana/example-react-hooks dev

# or npm
npm install
npx --yes pnpm --filter @solana/example-react-hooks dev
```

### What’s inside

- Cluster status card (latency + endpoint info)
- Wallet connector picker using Wallet Standard
- SOL transfer form (`useSolTransfer`)
- USDC transfer panel (`useSplToken`)
- Reusable Card/Button/Input components styled with Tailwind and class-variance-authority

### Build

```bash
# using pnpm
pnpm --filter @solana/example-react-hooks build

# or npm
npx --yes pnpm --filter @solana/example-react-hooks build
```

> If you consume `@solana/react-hooks` from the workspace, ensure the `@solana/client-poc` import is aliased to `@solana/client-core` (the example’s Vite config handles this).

---

## Scripts & Tooling

Everything uses pnpm workspaces:

```bash
pnpm install
pnpm --filter @solana/react-hooks test:typecheck
pnpm --filter @solana/example-react-hooks dev
```

Contributions welcome—file issues or PRs as needed. Happy shipping!

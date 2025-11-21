# `@solana/web3-compat`

Phase 0 of a backwards‑compatible surface that lets existing `@solana/web3.js`
code run on top of Kit primitives.

This package is designed to help migrate from web3.js to Kit.

The goal of this release is **zero breaking changes** for applications that only
touch the subset of web3.js APIs listed below. There will be future releases that slowly
implement breaking changes as they move over to Kit primitives and intuitions.

## Installation

```bash
pnpm add @solana/web3-compat
```

Your project must also have valid Kit peer dependencies (`@solana/kit`,
`@solana/client`, etc.).

## Usage

In Phase 0, you should be able to leave your web3.js code as-is.

The compatibility layer mirrors the web3.js entry points:

```ts
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3-compat";

const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
);

const payer = Keypair.generate();
const recipient = Keypair.generate().publicKey;

const transferIx = SystemProgram.transfer({
  fromPubkey: payer.publicKey,
  toPubkey: recipient,
  lamports: 1_000_000,
});

const transaction = new Transaction().add(transferIx);
transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
transaction.feePayer = payer.publicKey;

await sendAndConfirmTransaction(connection, transaction, [payer]);
```

Under the hood every RPC call goes through Kit via `@solana/client`, but currently
the surface area, return types, and error semantics stay aligned with
`@solana/web3.js`.

## Implemented in Phase 0

- `Connection` backed by Kit with support for:
  - `getLatestBlockhash`
  - `getBalance`
  - `getAccountInfo`
  - `getProgramAccounts`
  - `getSignatureStatuses`
  - `sendRawTransaction`
  - `confirmTransaction`
  - `simulateTransaction`
- Bridge helpers re-exported from `@solana/compat`:
  - `toAddress`, `toPublicKey`, `toWeb3Instruction`, `toKitSigner`
- Programs:
  - `SystemProgram.transfer` (manual u8/u64 little‑endian encoding)
- Utilities:
  - `LAMPORTS_PER_SOL`
  - `compileFromCompat`
  - `sendAndConfirmTransaction`
- Re‑exports of all Web3 primitives (`PublicKey`, `Keypair`, `Transaction`,
  `VersionedTransaction`, `TransactionInstruction`, etc)

## Running tests

```bash
pnpm --filter @solana/web3-compat test
```

## Examples

We've included some examples that are directly taken from Solana project code (eg `explorer`). We'll keep
updating these throughout the phases.

## Known limitations & edge cases

Phase 0 does not fully replace web3.js. Notable gaps:

- Only the Connection methods listed above are implemented. Any other Web3 call
  (e.g. `getTransaction`, subscriptions, `requestAirdrop`) still needs the
  legacy connection for now
- `getProgramAccounts` currently returns just the value array even when
  `withContext: true` is supplied
- Account data is decoded from `base64` only. Other encodings such as
  `jsonParsed` or `base64+zstd` are passed through to Kit but not post‑processed
- Numeric fields are coerced to JavaScript `number`s to match Web3 behaviour,
  which means values above `Number.MAX_SAFE_INTEGER` will lose precision (which is how it
  currently works)
- The compatibility layer does not yet try to normalise websocket connection
  options or retry policies that web3.js exposes

Future phases will expand coverage and introduce intentional
breaking changes once users have an easy migration path.

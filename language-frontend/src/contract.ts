import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Language } from '@eddalabs/voting-contract';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v7';
import type { TransactionId } from '@midnight-ntwrk/ledger-v7';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { map } from 'rxjs';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
function fromHex(hex: string): Uint8Array {
  const len = hex.length / 2;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

const PRIVATE_STATE_ID = 'languagePrivateState' as const;

const compiled = CompiledContract.make('language', Language.Contract).pipe(
  CompiledContract.withCompiledFileAssets(
    `${typeof window !== 'undefined' ? window.location.origin : ''}/midnight/language`
  )
);

export type WalletApi = {
  serviceUriConfig(): Promise<{ indexer: string; node: string; proofServer: string }>;
  coinPublicKey(): Promise<unknown>;
  getEncryptionPublicKey?(): Promise<unknown>;
  balanceTransaction(tx: UnboundTransaction, newCoins: unknown): Promise<FinalizedTransaction>;
  submitTransaction(tx: FinalizedTransaction): Promise<TransactionId>;
  enable(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
};

export type Providers = Awaited<ReturnType<typeof createProviders>>;

export async function createProviders(walletApi: WalletApi) {
  const uris = await walletApi.serviceUriConfig();
  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/midnight/language` : '';
  const zkConfigProvider = new FetchZkConfigProvider(baseUrl);

  const walletProvider = {
    getCoinPublicKey: () => walletApi.coinPublicKey(),
    getEncryptionPublicKey: () =>
      (walletApi.getEncryptionPublicKey ? walletApi.getEncryptionPublicKey() : walletApi.coinPublicKey()) as Promise<unknown>,
    balanceTx(tx: UnboundTransaction, _ttl?: Date) {
      return walletApi.balanceTransaction(tx, undefined);
    },
  };

  const midnightProvider = {
    submitTx(tx: FinalizedTransaction) {
      return walletApi.submitTransaction(tx);
    },
  };

  const privateStateProvider = levelPrivateStateProvider<typeof PRIVATE_STATE_ID, Record<string, never>>({
    privateStateStoreName: PRIVATE_STATE_ID,
    walletProvider: walletProvider as unknown as Parameters<typeof levelPrivateStateProvider>[0]['walletProvider'],
  });

  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(uris.indexer, uris.node),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(uris.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider,
  };
}

/**
 * Build providers from the official Midnight wallet's ConnectedAPI (connect(networkId) API).
 * Use this for the Midnight browser extension wallet.
 */
export async function createProvidersFromConnectedAPI(connectedAPI: ConnectedAPI): Promise<Providers> {
  const config = await connectedAPI.getConfiguration();
  const uris = {
    indexer: config.indexerUri,
    node: config.indexerWsUri,
    proofServer: config.proverServerUri ?? '',
  };
  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/midnight/language` : '';
  const zkConfigProvider = new FetchZkConfigProvider(baseUrl);

  const shielded = await connectedAPI.getShieldedAddresses();

  const walletProvider = {
    getCoinPublicKey: () => Promise.resolve(shielded.shieldedCoinPublicKey as unknown),
    getEncryptionPublicKey: () =>
      Promise.resolve(shielded.shieldedEncryptionPublicKey as unknown),
    balanceTx(tx: UnboundTransaction, _ttl?: Date): Promise<FinalizedTransaction> {
      const serialized = toHex(tx.serialize());
      return connectedAPI
        .balanceUnsealedTransaction(serialized)
        .then(({ tx: txHex }) =>
          ledger.Transaction.deserialize<ledger.SignatureEnabled, ledger.Proof, ledger.Binding>(
            'signature',
            'proof',
            'binding',
            fromHex(txHex)
          )
        );
    },
  };

  const midnightProvider = {
    submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      return connectedAPI
        .submitTransaction(toHex(tx.serialize()))
        .then(() => tx.identifiers()[0]);
    },
  };

  const privateStateProvider = levelPrivateStateProvider<typeof PRIVATE_STATE_ID, Record<string, never>>({
    privateStateStoreName: PRIVATE_STATE_ID,
    walletProvider: walletProvider as unknown as Parameters<typeof levelPrivateStateProvider>[0]['walletProvider'],
  });

  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(uris.indexer, uris.node),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(uris.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider,
  };
}

export type ContractHandle = Awaited<ReturnType<typeof joinContract>>;

export async function joinContract(providers: Providers, contractAddress: string) {
  const found = await findDeployedContract(providers as unknown as Parameters<typeof findDeployedContract>[0], {
    contractAddress,
    compiledContract: compiled as unknown as Parameters<typeof findDeployedContract>[1]['compiledContract'],
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
  return found;
}

/** Minimal providers for read-only contract state (no wallet). */
export type ReadOnlyProviders = { publicDataProvider: Providers['publicDataProvider'] };

/**
 * Indexer URLs fixed to match midnight-local-network Docker (indexer 8088).
 * Do not change; deployment.json can override indexerHttp/indexerWs if needed.
 */
export const DEFAULT_INDEXER_HTTP = 'http://127.0.0.1:8088/api/v3/graphql';
export const DEFAULT_INDEXER_WS = 'ws://127.0.0.1:8088/api/v3/graphql/ws';

export function createReadOnlyProviders(indexerHttp: string, indexerWs: string): ReadOnlyProviders {
  return {
    publicDataProvider: indexerPublicDataProvider(indexerHttp, indexerWs),
  };
}

export function contractStateStream(
  providers: ReadOnlyProviders | Providers,
  contractAddress: string
) {
  return providers.publicDataProvider
    .contractStateObservable(contractAddress, { type: 'all' })
    .pipe(
      map((s) => Language.ledger(s.data)),
      map((ledger) => ({ verifiedUsers: ledger.verifiedUsers }))
    );
}

export async function quickVerify(
  contract: ContractHandle,
  userLevel: bigint,
  minLevel: bigint
) {
  await contract.callTx.quickVerify(userLevel, minLevel);
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  contractStateStream,
  createProvidersFromConnectedAPI,
  createReadOnlyProviders,
  DEFAULT_INDEXER_HTTP,
  DEFAULT_INDEXER_WS,
  joinContract,
  quickVerify,
  type ContractHandle,
  type Providers,
} from './contract';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

type Deployment = {
  contractAddress: string;
  network: string;
  deployedAt: string;
  indexerHttp?: string;
  indexerWs?: string;
};

const WALLET_STORAGE_KEYS = ['rdns-connected', 'network-id'] as const;

export default function App() {
  const [walletReady, setWalletReady] = useState(false);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [unshieldedAddress, setUnshieldedAddress] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState('');
  const [contract, setContract] = useState<ContractHandle | null>(null);
  const [verifiedUsers, setVerifiedUsers] = useState<bigint | null>(null);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [userLevel, setUserLevel] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset wallet state on every load so refresh always starts disconnected
  useEffect(() => {
    WALLET_STORAGE_KEYS.forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    });
  }, []);

  useEffect(() => {
    fetch('/deployment.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Deployment | null) => {
        if (d?.contractAddress) {
          setDeployment(d);
          setContractAddress(d.contractAddress);
        }
      })
      .catch(() => {});
  }, []);

  const connectWallet = useCallback(async () => {
    setError(null);
    const midnight = typeof window !== 'undefined' ? window.midnight : null;
    if (!midnight || typeof midnight !== 'object') {
      setError('Midnight wallet not found. Install the Midnight wallet extension.');
      return;
    }
    const wallets: { key: string; api: InitialAPI }[] = [];
    for (const key of Object.keys(midnight)) {
      const w = midnight[key];
      if (w?.name && typeof w.connect === 'function') wallets.push({ key, api: w });
    }
    if (wallets.length === 0) {
      setError('No compatible Midnight wallet found. Install the Midnight wallet extension.');
      return;
    }
    const preferred = wallets.find((w) => /midnight/i.test(w.api.name)) ?? wallets[0];
    const networkId = deployment?.network === 'undeployed' ? 'undeployed' : deployment?.network ?? 'undeployed';
    try {
      const connectedAPI = await preferred.api.connect(networkId);
      if (!connectedAPI) {
        setError('Wallet connection was rejected or failed.');
        return;
      }
      const { unshieldedAddress: addr } = await connectedAPI.getUnshieldedAddress();
      setUnshieldedAddress(addr ?? null);
      const prov = await createProvidersFromConnectedAPI(connectedAPI);
      setProviders(prov);
      setWalletReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    }
  }, [deployment?.network]);

  const JOIN_TIMEOUT_MS = 60_000;

  const onJoin = useCallback(async () => {
    if (!providers || !contractAddress.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const c = await Promise.race([
        joinContract(providers, contractAddress.trim()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Join timed out (60s). Check indexer is synced and wallet network is undeployed.')), JOIN_TIMEOUT_MS)
        ),
      ]);
      setContract(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Join failed');
    } finally {
      setLoading(false);
    }
  }, [providers, contractAddress]);

  const effectiveContractAddress = contractAddress.trim() || deployment?.contractAddress || '';
  const readOnlyProviders = useMemo(() => {
    if (!effectiveContractAddress) return null;
    return createReadOnlyProviders(
      deployment?.indexerHttp ?? DEFAULT_INDEXER_HTTP,
      deployment?.indexerWs ?? DEFAULT_INDEXER_WS
    );
  }, [effectiveContractAddress, deployment?.indexerHttp, deployment?.indexerWs]);

  useEffect(() => {
    if (!effectiveContractAddress || !readOnlyProviders) return;
    const sub = contractStateStream(readOnlyProviders, effectiveContractAddress).subscribe({
      next: (s) => setVerifiedUsers(s.verifiedUsers),
      error: (e) => setError(e instanceof Error ? e.message : 'Failed to load contract state'),
    });
    return () => sub.unsubscribe();
  }, [effectiveContractAddress, readOnlyProviders]);

  // When joined, keep state in sync (same stream works with full providers too)
  useEffect(() => {
    if (!contract || !providers) return;
    const addr = contract.deployTxData.public.contractAddress;
    const sub = contractStateStream(providers, addr).subscribe((s) => setVerifiedUsers(s.verifiedUsers));
    return () => sub.unsubscribe();
  }, [contract, providers]);

  const onQuickVerify = useCallback(async () => {
    if (!contract) return;
    const u = BigInt(userLevel);
    const m = BigInt(minLevel);
    setError(null);
    setLoading(true);
    try {
      await quickVerify(contract, u, m);
      setUserLevel('');
      setMinLevel('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'quickVerify failed');
    } finally {
      setLoading(false);
    }
  }, [contract, userLevel, minLevel]);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Language Proficiency Gate</h1>
      <p style={styles.subtitle}>Verify proficiency and see verified users count.</p>

      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {effectiveContractAddress && (
        <section style={styles.interactionSection}>
          <h2 style={styles.sectionTitle}>Your contract interaction</h2>
          <p style={styles.state}>
            Verified users: <strong>{verifiedUsers !== null ? String(verifiedUsers) : '…'}</strong>
          </p>
          <p style={styles.interactionNote}>
            This is live data from your deployed contract (indexer). No join needed to see it.
          </p>
          <p style={styles.meta}>Contract: {effectiveContractAddress.slice(0, 20)}…</p>
          <p style={styles.meta}>Join is only required to call Quick verify (submit a transaction).</p>
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Wallet & contract</h2>
        <p style={styles.connectHint}>Connection is not saved — refresh the page to reset.</p>
        {!walletReady ? (
          <div style={styles.connectBlock}>
            <button type="button" onClick={connectWallet} style={styles.primaryButton}>
              Connect Wallet
            </button>
            <p style={styles.connectHint}>Connect your Midnight wallet to continue.</p>
          </div>
        ) : (
          <div style={styles.block}>
            {unshieldedAddress && (
              <div style={styles.addressBlock}>
                <label style={styles.label}>Unshielded address</label>
                <p style={styles.addressValue} title={unshieldedAddress}>
                  {unshieldedAddress}
                </p>
                <button
                  type="button"
                  style={styles.copyButton}
                  onClick={() => {
                    navigator.clipboard?.writeText(unshieldedAddress);
                  }}
                >
                  Copy
                </button>
              </div>
            )}
            <label style={styles.label}>Contract address</label>
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="From deployment.json or paste"
              style={styles.input}
            />
            {deployment && (
              <p style={styles.meta}>
                From deployment.json — network: {deployment.network}, deployed: {new Date(deployment.deployedAt).toLocaleString()}
              </p>
            )}
            {!contract ? (
              <button
                type="button"
                onClick={onJoin}
                disabled={loading || !contractAddress.trim()}
                style={styles.button}
              >
                {loading ? 'Joining…' : 'Join contract'}
              </button>
            ) : (
              <p style={styles.success}>Joined contract.</p>
            )}
          </div>
        )}
      </section>

      {contract && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Quick verify</h2>
            <p style={styles.hint}>
              Call quickVerify(userLevel, minLevel). Your level must be ≥ min level.
            </p>
            <div style={styles.row}>
              <div>
                <label style={styles.label}>Your level</label>
                <input
                  type="number"
                  min={0}
                  value={userLevel}
                  onChange={(e) => setUserLevel(e.target.value)}
                  placeholder="e.g. 3"
                  style={styles.inputNarrow}
                />
              </div>
              <div>
                <label style={styles.label}>Min level</label>
                <input
                  type="number"
                  min={0}
                  value={minLevel}
                  onChange={(e) => setMinLevel(e.target.value)}
                  placeholder="e.g. 2"
                  style={styles.inputNarrow}
                />
              </div>
              <button
                type="button"
                onClick={onQuickVerify}
                disabled={loading || userLevel === '' || minLevel === ''}
                style={styles.button}
              >
                {loading ? 'Submitting…' : 'Quick verify'}
              </button>
            </div>
          </section>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '2rem',
    maxWidth: '36rem',
    margin: '0 auto',
    fontFamily: 'system-ui, sans-serif',
    color: '#1a1a1a',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#555',
    marginBottom: '2rem',
  },
  error: {
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    background: '#fef2f2',
    color: '#b91c1c',
    borderRadius: '6px',
    fontSize: '0.875rem',
  },
  section: {
    marginBottom: '2rem',
    padding: '1.25rem',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  interactionSection: {
    marginBottom: '2rem',
    padding: '1.25rem',
    background: '#eff6ff',
    border: '1px solid #3b82f6',
    borderRadius: '8px',
  },
  interactionNote: {
    fontSize: '0.875rem',
    color: '#1e40af',
    margin: '0.5rem 0',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  block: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    color: '#555',
    marginBottom: '0.25rem',
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.875rem',
  },
  inputNarrow: {
    width: '5rem',
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.875rem',
  },
  meta: { fontSize: '0.75rem', color: '#6b7280' },
  connectBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    alignItems: 'flex-start',
  },
  primaryButton: {
    padding: '0.625rem 1.25rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.9375rem',
    cursor: 'pointer',
  },
  connectHint: {
    fontSize: '0.8125rem',
    color: '#6b7280',
    margin: 0,
  },
  addressBlock: {
    marginBottom: '0.75rem',
    padding: '0.5rem 0',
    borderBottom: '1px solid #e5e7eb',
  },
  addressValue: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    wordBreak: 'break-all' as const,
    color: '#374151',
    margin: '0.25rem 0',
  },
  copyButton: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  button: {
    padding: '0.5rem 1rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 500,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  success: { color: '#059669', fontSize: '0.875rem' },
  state: { fontSize: '1rem' },
  hint: { fontSize: '0.875rem', color: '#555', marginBottom: '0.75rem' },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: '1rem',
  },
};

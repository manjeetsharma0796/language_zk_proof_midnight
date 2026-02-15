# Language Proficiency Gate

Frontend app that interacts with the deployed **Language** smart contract: verify proficiency and see the verified users count in real time.

## What the app does

- **Shows live contract state** — Displays **Verified users** count from your deployed contract (read from the indexer; no wallet join required).
- **Connect Midnight wallet** — Uses the official Midnight wallet extension (unshielded address shown when connected).
- **Join contract** — Attach to the deployed contract to submit transactions (optional; only needed for Quick verify).
- **Quick verify** — Call `quickVerify(userLevel, minLevel)` to prove your level meets a minimum (requires join).
- **Reset on refresh** — Wallet connection is not persisted; refresh the page to reset.

## Deployed contract

| Field | Value |
|-------|--------|
| **Contract address** | `d9eceafb52a63da8fee268f705b0062605773ef907745d3ae4d43690625c2641` |
| **Network** | undeployed |
| **Deployed** | 2026-02-15 |

Contract address is loaded from `public/deployment.json` (copied from `voting-contract/deployment.json`).

## Proof of working

The app running locally, showing contract interaction and wallet connection:

![Language Proficiency Gate — contract interaction and wallet](screenshot.png)

## Setup

1. Install and copy contract assets:

   ```bash
   cd language-frontend
   npm install
   npm run copy-assets
   ```

   This copies the Language contract ZK assets and `deployment.json` from `../voting-contract`.

2. Ensure your local node and indexer are running (e.g. Docker: indexer **8088**, node **9944**, proof-server **6300**).

## Run

```bash
npm run dev
```

Open the URL shown (e.g. http://localhost:5174).

## Build

```bash
npm run build
```

Output is in `dist/`.

## Flow

1. Open the app; **Your contract interaction** shows **Verified users** from the indexer (no connect needed).
2. Click **Connect Wallet** to connect the Midnight wallet; your unshielded address is shown.
3. Contract address is prefilled from `deployment.json`; click **Join contract** if you want to call Quick verify.
4. After joining, enter **Your level** and **Min level**, then click **Quick verify** to submit a transaction.

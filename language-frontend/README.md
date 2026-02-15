# Language Proficiency Gate — Frontend

Standalone frontend for the Language contract. Uses `deployment.json` and the contract’s `verifiedUsers` ledger and `quickVerify` circuit.

## Setup

1. From repo root (or from this folder with correct `../voting-contract`):

   ```bash
   cd language-frontend
   npm install
   ```

2. Copy contract assets and deployment info:

   ```bash
   npm run copy-assets
   ```

   This copies:

   - `../voting-contract/src/managed/language/zkir/*` → `public/midnight/language/zkir/`
   - `../voting-contract/deployment.json` → `public/deployment.json`

   Run after deploying the contract so the app has the correct contract address.

## Run

```bash
npm run dev
```

Then open the URL shown (e.g. http://localhost:5173).

## Build

```bash
npm run build
```

Output is in `dist/`.

## Flow

1. Connect Midnight Wallet (Lace).
2. Contract address is prefilled from `public/deployment.json` if present; you can change it.
3. Click “Join contract” to attach to the deployed Language contract.
4. View “Verified users” (live from chain).
5. Enter “Your level” and “Min level”, then “Quick verify” to call `quickVerify(userLevel, minLevel)`.

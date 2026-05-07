# MidBid

MidBid is a Miden testnet dApp for private sealed-bid auctions.

The app lets a seller create an auction room, publish it to a global registry, accept private Miden note bids, and reveal only the winning result after the deadline. It is built around Miden's account, asset, and note model rather than an EVM-style contract flow.

MidBid is experimental testnet software. Do not use it with mainnet funds or valuable assets.

## What It Does

- Connects to the Miden browser wallet extension.
- Reads the active wallet account, faucet assets, balances, and claimable notes.
- Creates auction rooms with an item image, title, reserve price, deadline, description, and settlement account.
- Publishes global auction metadata through Supabase when env keys are configured.
- Sends bids as private Miden notes to the auction settlement account.
- Stores encrypted bid receipts in Supabase so the creator can reveal the winning bid without publishing every bid amount.
- Supports creator-only auction deletion and creator-only winner reveal.
- Shows pending and closed auctions in separate tabs.
- Keeps the UI responsive across desktop and mobile.

## How The Flow Works

1. The seller connects a Miden testnet wallet.
2. The seller creates an auction with an item image, reserve amount, and deadline.
3. MidBid publishes the auction card globally if Supabase is configured.
4. A bidder connects their Miden wallet, opens the auction card, enters an amount, and approves a private note send.
5. The private note goes to the seller's settlement account.
6. The bidder also publishes an encrypted bid receipt. The receipt is public, but the bid payload is encrypted for the auction creator.
7. After the deadline, the creator opens the closed auction and reveals the highest available settlement candidate.
8. The final result is written back to Supabase so every visitor sees the same winner.

The reveal key and edit token are kept in the creator browser. If that browser storage is cleared, the creator may lose the ability to decrypt bid receipts or delete/reveal through the app.

## Tech Stack

- React 19
- Vite
- Miden SDK and Miden wallet adapter
- Supabase Postgres and PostgREST
- Web Crypto API for encrypted bid receipts
- Plain CSS for the MidBid interface

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open:

```txt
http://127.0.0.1:5173
```

Useful checks:

```bash
npm run lint
npm run build
```

## Supabase Setup

MidBid can run without Supabase, but auctions will only live in the current browser. Use Supabase when you want auctions, encrypted bid receipts, and revealed winners to be visible globally.

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Paste and run `supabase/midbid.sql`.
4. Go to Project Settings -> API.
5. Copy the Project URL and anon public key.
6. Create `.env.local` from `.env.example`.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Only use the anon public key. Never put a Supabase service role key in this frontend app.

## Testing Checklist

1. Connect a Miden-compatible browser wallet on testnet.
2. Open the faucet from MidBid or visit `https://faucet.testnet.miden.io/`.
3. Fund the wallet, claim the faucet note in the wallet, then refresh MidBid.
4. Create an auction from the seller wallet.
5. Confirm the auction card says `global` if Supabase is working.
6. Switch to a funded bidder account in the wallet extension.
7. Open the auction card and submit a private bid.
8. Switch back to the seller wallet.
9. Wait until the auction is closed.
10. Open the closed auction card.
11. Reveal the winner.
12. Refresh another browser and confirm the revealed result is visible globally.

## Deployment

The app is a Vite frontend. There is no custom Node backend to deploy.

Use Vercel with:

```txt
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Add the same env vars in Vercel:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Supabase handles the database, row-level security policies, and RPC functions. Vercel only hosts the frontend.

## Project Structure

```txt
midbid/
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ components/
│  │  ├─ AuctionCreateModal.jsx
│  │  ├─ AuctionStudio.jsx
│  │  ├─ AuctionSummary.jsx
│  │  ├─ BidAction.jsx
│  │  ├─ BidModal.jsx
│  │  ├─ FeedbackOverlay.jsx
│  │  ├─ HeroPanel.jsx
│  │  ├─ PrivateInbox.jsx
│  │  ├─ SettlementModal.jsx
│  │  ├─ SettlementPanel.jsx
│  │  ├─ TopBar.jsx
│  │  ├─ WindowChrome.jsx
│  │  ├─ icons.jsx
│  │  └─ ui.jsx
│  ├─ hooks/
│  │  └─ useMidenPay.js
│  ├─ lib/
│  │  ├─ bidPrivacy.js
│  │  ├─ formatUtils.js
│  │  ├─ midbidProtocol.js
│  │  ├─ midenExtensionWallet.js
│  │  └─ supabaseStore.js
│  ├─ App.css
│  ├─ App.jsx
│  ├─ index.css
│  └─ main.jsx
├─ supabase/
│  └─ midbid.sql
├─ .env.example
├─ .gitignore
├─ eslint.config.js
├─ index.html
├─ package-lock.json
├─ package.json
├─ postcss.config.js
├─ tailwind.config.js
└─ vite.config.js
```

## Current Limitations

- MidBid targets Miden testnet only.
- Wallet behavior depends on the installed Miden browser wallet extension.
- Auction metadata and encrypted receipts are global through Supabase, while private bid settlement still happens through Miden notes.
- The creator browser holds the local reveal/deletion secrets.
- The app is unaudited.


# MidBid

MidBid is a Miden testnet workspace for private sealed-bid auction flows.

It connects to the Miden browser wallet extension, reads wallet assets and claimable notes, lets an auction creator publish a private sealed-bid auction with an item image, routes private bids to the chosen settlement account, and prepares wallet-approved private Miden note sends for bid submission.

## Features

- Miden wallet extension connect, refresh, switch, disconnect, and faucet shortcut.
- Manual auction creation modal for item image, title, reserve, deadline, description, and settlement account.
- Wallet-account auction routing for stable testnet bidding.
- Manifest hash and bid commitment receipts for private sealed-bid tracking.
- Sealed-bid room link using `midbid://auction` payloads.
- Private note bid submission through a focused modal opened from the auction card.
- Encrypted bid receipts stored in Supabase so creator-side reveal works even when the wallet has already applied the incoming note to activity.
- Asset balance preflight, selected faucet asset display, lifecycle tracking, and private bid note inbox.
- Winner reveal after deadline from creator-side settlement candidates recorded when bid notes are claimed.
- Creator-only global auction deletion through a Supabase edit token.
- Light and dark mode with the existing MidBid visual system.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Supabase Setup

MidBid works locally without Supabase keys. Add Supabase when you want auctions and reveal results to be visible to every visitor.

1. In Supabase, create a new project.
2. Open SQL Editor, paste the contents of `supabase/midbid.sql`, and run it once.
3. Open Project Settings -> API.
4. Copy the Project URL and anon public key.
5. Create `.env.local` from `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

6. Restart `npm run dev`.

Use the anon public key only. Never place the Supabase service role key in a Vite/frontend app.

## Testing Flow

1. Connect a Miden testnet wallet.
2. Fund the wallet from `https://faucet.testnet.miden.io/` and claim the note in the wallet.
3. Refresh assets in MidBid.
4. Open Create auction, upload the item image, and enter the auction terms.
5. Create the auction. MidBid publishes the room and uses the connected settlement account for private bid notes.
6. Switch to a funded bidder account in the wallet extension.
7. Tap the created auction card, submit a private bid note, and approve in the wallet.
8. Switch back to the auction account.
9. After the deadline, tap the closed auction card to open settlement, claim incoming bid notes, and reveal the highest creator-side settlement candidate.

## Global Availability

With Supabase configured, MidBid publishes auction manifests and winner reveal records to `public.midbid_auctions`, so new visitors can load the same auction rooms globally.

The private bid path still runs through Miden notes. Supabase stores the item metadata, auction account, manifest hash, image, deadline, encrypted bid receipts, and final revealed result. It does not store plaintext private bid amounts or creator-side settlement candidates as public auction rows.

Auction deletion is protected by the creator browser's local edit token. If local storage is cleared, delete the row manually in Supabase.

Without Supabase keys, MidBid falls back to local browser storage and copied `midbid://auction` payloads.

This is experimental testnet software and is not audited.

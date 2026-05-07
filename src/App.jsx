import { useEffect, useMemo, useRef, useState } from 'react'
import { AuctionCreateModal } from './components/AuctionCreateModal'
import { AuctionSummary } from './components/AuctionSummary'
import { AuctionStudio } from './components/AuctionStudio'
import { BidModal } from './components/BidModal'
import { FeedbackOverlay } from './components/FeedbackOverlay'
import { HeroPanel } from './components/HeroPanel'
import { SettlementModal } from './components/SettlementModal'
import { TopBar } from './components/TopBar'
import { WindowChrome } from './components/WindowChrome'
import { useMidenPay } from './hooks/useMidenPay'
import { decryptBidPayload, encryptBidPayload, generateBidKeyPair } from './lib/bidPrivacy'
import {
  buildAuctionLink,
  formatAuctionDeadline,
  getLocalTimezone,
  isAuctionClosed,
} from './lib/formatUtils'
import { createAuctionManifest, createBidSeal, MIDBID_NOTE_MODE, MIDBID_PROTOCOL_VERSION } from './lib/midbidProtocol'
import {
  deleteGlobalAuction,
  fetchGlobalBidReceipts,
  fetchGlobalAuctions,
  getSupabaseMode,
  isSupabaseConfigured,
  publishGlobalAuction,
  publishGlobalBidReceipt,
  publishGlobalReveal,
} from './lib/supabaseStore'
import './App.css'

const auctionStorageKey = 'midbid:auctions:v1'

function App() {
  const [theme, setTheme] = useState('dark')
  const miden = useMidenPay()
  const [auctions, setAuctions] = useState(readStoredAuctions)
  const [activeAuctionId, setActiveAuctionId] = useState(() => readStoredActiveAuctionId())
  const [auctionTab, setAuctionTab] = useState('pending')
  const [bidAmount, setBidAmount] = useState('')
  const [bidModalOpen, setBidModalOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [manualCandidateAmount, setManualCandidateAmount] = useState('')
  const [settlementModalOpen, setSettlementModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [globalState, setGlobalState] = useState(createInitialGlobalState)
  const [clock, setClock] = useState(() => Date.now())
  const [scrollTargetAuctionId, setScrollTargetAuctionId] = useState('')
  const auctionSummaryRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setClock(Date.now())
    }, 1000)

    return () => globalThis.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined

    let cancelled = false

    fetchGlobalAuctions()
      .then((globalAuctions) => {
        if (cancelled) return

        let nextAuctions = []

        setAuctions((items) => {
          nextAuctions = mergeGlobalAuctions(items, globalAuctions)
          return nextAuctions
        })
        setActiveAuctionId((current) =>
          nextAuctions.some((auction) => auction.id === current) ? current : nextAuctions[0]?.id || '',
        )
        setGlobalState({
          mode: 'global',
          message:
            globalAuctions.length > 0
              ? `${globalAuctions.length} global auction${globalAuctions.length === 1 ? '' : 's'} synced.`
              : 'Global registry connected. No auctions published yet.',
          status: 'synced',
        })
      })
      .catch((error) => {
        if (cancelled) return

        setGlobalState({
          mode: 'global',
          message: `Supabase sync failed: ${getErrorMessage(error)}`,
          status: 'error',
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!scrollTargetAuctionId) return undefined
    if (!auctions.some((auction) => auction.id === scrollTargetAuctionId)) return undefined

    const frameId = globalThis.requestAnimationFrame?.(() => {
      auctionSummaryRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start',
      })
      setScrollTargetAuctionId('')
    })

    return () => {
      if (frameId) globalThis.cancelAnimationFrame?.(frameId)
    }
  }, [auctions, scrollTargetAuctionId])

  useEffect(() => {
    globalThis.localStorage?.setItem(auctionStorageKey, JSON.stringify(auctions))
  }, [auctions])

  useEffect(() => {
    if (activeAuctionId) {
      globalThis.localStorage?.setItem('midbid:active-auction-id', activeAuctionId)
    } else {
      globalThis.localStorage?.removeItem('midbid:active-auction-id')
    }
  }, [activeAuctionId])

  const connectedSettlementAccount =
    miden.isConnected && miden.account.id !== 'connect extension' ? miden.account.id : ''
  const hasCreatorWallet = isLikelyMidenAccount(connectedSettlementAccount)

  useEffect(() => {
    if (createModalOpen && !hasCreatorWallet) {
      setCreateModalOpen(false)
    }
  }, [createModalOpen, hasCreatorWallet])

  const selectedAuction = useMemo(
    () => auctions.find((item) => item.id === activeAuctionId) || auctions[0] || null,
    [activeAuctionId, auctions],
  )

  const activeAuction = useMemo(
    () =>
      selectedAuction
        ? {
            ...selectedAuction,
            settlementAccount: selectedAuction.settlementAccount || connectedSettlementAccount,
          }
        : null,
    [connectedSettlementAccount, selectedAuction],
  )

  const auctionLink = useMemo(
    () =>
      activeAuction
        ? buildAuctionLink({ account: miden.account, auction: activeAuction, selectedAsset: miden.selectedAsset })
        : '',
    [activeAuction, miden.account, miden.selectedAsset],
  )

  const preflight = miden.validateDraft({
    amount: bidAmount,
    recipient: activeAuction?.settlementAccount || '',
  })
  const auctionClosed = activeAuction ? isAuctionClosed(activeAuction.endsAt, clock) : false
  const preflightItems = [
    { label: 'Auction created', ok: Boolean(activeAuction) },
    ...preflight.items,
    { label: 'Auction is pending', ok: !auctionClosed },
  ]
  const bidPreflightReady = preflightItems.every((item) => item.ok)
  const bidPreflight = {
    items: preflightItems,
    ready: bidPreflightReady,
    summary: !activeAuction
      ? 'Create an auction first.'
      : auctionClosed
        ? 'Auction closed. Bids are disabled.'
        : 'Resolve blocked checks',
  }

  async function handleSubmitBid(event) {
    event.preventDefault()
    if (!bidAmount || !activeAuction?.settlementAccount || auctionClosed) return

    const bidSeal = await createBidSeal({
      amount: bidAmount,
      asset: miden.selectedAsset,
      auction: activeAuction,
      bidder: miden.account.id,
    })
    const result = await miden.submitBid({
      amount: bidAmount,
      noteType: 'private',
      recipient: activeAuction.settlementAccount,
    })

    if (!result?.ok) return

    const bidRecord = {
      amount: bidAmount,
      asset: miden.account.asset,
      bidder: miden.account.id,
      commitment: bidSeal.commitment,
      commitmentShort: bidSeal.commitmentShort,
      createdAt: new Date().toISOString(),
      id: `bid_${Date.now().toString(16)}`,
      privacy: bidSeal.privacy,
      protocol: bidSeal.protocol,
      status: result.confirmed ? 'confirmed' : 'submitted',
      txId: result.txId || '',
    }

    setAuctions((items) =>
      items.map((item) =>
        item.id === activeAuction.id
          ? {
              ...item,
              bids: [bidRecord, ...(item.bids || [])],
            }
          : item,
      ),
    )

    if (isSupabaseConfigured() && activeAuction.bidPublicKey) {
      try {
        const encryptedPayload = await encryptBidPayload(activeAuction.bidPublicKey, {
          amount: bidAmount,
          asset: miden.account.asset,
          bidder: miden.account.id,
          commitment: bidSeal.commitment,
          createdAt: bidRecord.createdAt,
          txId: bidRecord.txId,
        })

        await publishGlobalBidReceipt({
          auction: activeAuction,
          bidRecord,
          encryptedPayload,
        })
      } catch (error) {
        setGlobalState({
          mode: 'global',
          message: `Bid sent, but encrypted receipt publish failed: ${getErrorMessage(error)}`,
          status: 'warning',
        })
      }
    }

    setBidModalOpen(false)
  }

  async function handleRevealWinner() {
    if (!activeAuction || !auctionClosed) return false

    if (!isAuctionCreator(activeAuction, miden.account.id)) {
      setGlobalState({
        mode: isSupabaseConfigured() ? 'global' : 'local',
        message: 'Connect the creator wallet before revealing this auction.',
        status: 'warning',
      })
      return false
    }

    const winner = revealHighestBid(activeAuction, miden.notes)

    if (!winner) return false

    let revealedAuction = {
      ...activeAuction,
      revealedAt: winner.revealedAt,
      status: 'revealed',
      updatedAt: winner.revealedAt,
      winner,
    }

    if (isSupabaseConfigured()) {
      if (activeAuction.editToken) {
        setGlobalState({
          mode: 'global',
          message: 'Publishing winner reveal to Supabase...',
          status: 'publishing',
        })

        try {
          revealedAuction = await publishGlobalReveal(revealedAuction, winner, miden.account.id)
          setGlobalState({
            mode: 'global',
            message: 'Winner reveal is now globally visible.',
            status: 'synced',
          })
        } catch (error) {
          setGlobalState({
            mode: 'global',
            message: `Reveal saved locally. Supabase publish failed: ${getErrorMessage(error)}`,
            status: 'error',
          })
        }
      } else {
        setGlobalState({
          mode: 'global',
          message: 'Only the browser that created this auction can publish the global reveal.',
          status: 'warning',
        })
      }
    }

    setAuctions((items) =>
      items.map((item) =>
        item.id === activeAuction.id
          ? preserveLocalAuctionData(item, revealedAuction)
          : item,
      ),
    )

    return true
  }

  async function handleConsumeBidNote(noteId) {
    if (!activeAuction) return

    const note = miden.notes.find((item) => item.id === noteId)

    if (!note) return

    const result = await miden.consumeNote(noteId)

    if (!result?.ok) return

    const candidate = createSettlementCandidate(note, result.txId)

    setAuctions((items) =>
      items.map((item) =>
        item.id === activeAuction.id
          ? {
              ...item,
              settlementCandidates: addSettlementCandidate(item.settlementCandidates, candidate),
            }
          : item,
      ),
    )
  }

  function handleAddManualCandidate(event) {
    event.preventDefault()
    if (!activeAuction || !manualCandidateAmount.trim()) return

    const candidate = createSettlementCandidate(
      {
        amount: manualCandidateAmount,
        asset: miden.account.asset || 'MIDEN',
        from: 'creator recorded bid',
        id: `manual_${Date.now().toString(16)}`,
      },
      '',
    )

    setAuctions((items) =>
      items.map((item) =>
        item.id === activeAuction.id
          ? {
              ...item,
              settlementCandidates: addSettlementCandidate(item.settlementCandidates, candidate),
            }
          : item,
      ),
    )
    setManualCandidateAmount('')
  }

  async function loadEncryptedBidReceipts(auction) {
    if (!isSupabaseConfigured() || !auction?.bidPrivateKey) return

    try {
      const receipts = await fetchGlobalBidReceipts(auction.id)
      const decryptedCandidates = (
        await Promise.all(
          receipts.map(async (receipt) => {
            try {
              const payload = await decryptBidPayload(auction.bidPrivateKey, receipt.encrypted_payload)

              return createSettlementCandidate(
                {
                  amount: payload.amount,
                  asset: payload.asset || 'MIDEN',
                  from: payload.bidder || 'private bidder',
                  id: receipt.id,
                },
                payload.txId || receipt.id,
              )
            } catch {
              return null
            }
          }),
        )
      ).filter(Boolean)

      if (decryptedCandidates.length === 0) return

      setAuctions((items) =>
        items.map((item) =>
          item.id === auction.id
            ? {
                ...item,
                settlementCandidates: decryptedCandidates.reduce(
                  (candidates, candidate) => addSettlementCandidate(candidates, candidate),
                  item.settlementCandidates || [],
                ),
              }
            : item,
        ),
      )
    } catch (error) {
      setGlobalState({
        mode: 'global',
        message: `Could not load encrypted bid receipts: ${getErrorMessage(error)}`,
        status: 'warning',
      })
    }
  }

  async function copyAuctionLink(targetAuction = activeAuction) {
    const link = targetAuction
      ? buildAuctionLink({ account: miden.account, auction: targetAuction, selectedAsset: miden.selectedAsset })
      : auctionLink

    if (!link) return

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(link)
    }

    setCopied(true)
    window.setTimeout(() => setCopied(false), 900)
  }

  async function handleDeleteAuction(targetAuction = activeAuction) {
    if (!targetAuction) return

    if (!isAuctionCreator(targetAuction, miden.account.id)) {
      setGlobalState({
        mode: isSupabaseConfigured() ? 'global' : 'local',
        message: 'Connect the creator wallet before deleting this auction.',
        status: 'warning',
      })
      return
    }

    const confirmed =
      globalThis.confirm?.(`Delete "${targetAuction.title}" from MidBid? This cannot be undone.`) ?? true

    if (!confirmed) return

    if (isSupabaseConfigured() && targetAuction.syncStatus === 'global') {
      if (!targetAuction.editToken) {
        setGlobalState({
          mode: 'global',
          message: 'Only the browser that created this auction can delete it from Supabase.',
          status: 'warning',
        })
        return
      }

      setGlobalState({
        mode: 'global',
        message: 'Deleting auction from the global registry...',
        status: 'publishing',
      })

      try {
        await deleteGlobalAuction(targetAuction, miden.account.id)
        setGlobalState({
          mode: 'global',
          message: 'Auction deleted from Supabase.',
          status: 'synced',
        })
      } catch (error) {
        setGlobalState({
          mode: 'global',
          message: `Delete failed: ${getErrorMessage(error)}`,
          status: 'error',
        })
        return
      }
    }

    const nextAuctions = auctions.filter((item) => item.id !== targetAuction.id)

    setAuctions(nextAuctions)
    setActiveAuctionId(nextAuctions[0]?.id || '')
    setBidModalOpen(false)
    setSettlementModalOpen(false)
  }

  async function handleOpenAuctionAction(auction) {
    if (!auction) return

    setActiveAuctionId(auction.id)

    if (isAuctionClosed(auction.endsAt, clock)) {
      setBidModalOpen(false)
      setSettlementModalOpen(true)
      await loadEncryptedBidReceipts(auction)
      return
    }

    setSettlementModalOpen(false)
    setBidAmount((current) => current || auction.reserve || '')
    setBidModalOpen(true)
  }

  async function handleOpenCreateAuction() {
    if (!hasCreatorWallet) {
      await miden.connect()
      return
    }

    setCreateModalOpen(true)
  }

  async function handleCreateAuction(form) {
    if (!hasCreatorWallet) {
      setCreateModalOpen(false)
      await miden.connect()
      return null
    }

    const bidKeys = await generateBidKeyPair()
    let nextAuction = await createAuctionRecord({
      ...form,
      bidPrivateKey: bidKeys.privateKey,
      bidPublicKey: bidKeys.publicKey,
      creatorAccount: connectedSettlementAccount || form.settlementAccount,
      noteType: 'private',
      settlementAccount: form.settlementAccount || connectedSettlementAccount,
      vaultKind: 'wallet',
    })

    if (isSupabaseConfigured()) {
      setGlobalState({
        mode: 'global',
        message: 'Publishing auction to the global registry...',
        status: 'publishing',
      })

      try {
        nextAuction = await publishGlobalAuction(nextAuction)
        setGlobalState({
          mode: 'global',
          message: 'Auction is globally discoverable.',
          status: 'synced',
        })
      } catch (error) {
        nextAuction = {
          ...nextAuction,
          syncStatus: 'local',
        }
        setGlobalState({
          mode: 'global',
          message: `Auction saved locally. Supabase publish failed: ${getErrorMessage(error)}`,
          status: 'error',
        })
      }
    }

    setAuctions((items) => [nextAuction, ...items])
    setActiveAuctionId(nextAuction.id)
    setBidAmount(nextAuction.reserve || bidAmount)
    setAuctionTab(isAuctionClosed(nextAuction.endsAt) ? 'closed' : 'pending')
    setScrollTargetAuctionId(nextAuction.id)
    return nextAuction
  }

  return (
    <div className="app-shell">
      <div className="grid-lines" aria-hidden="true"></div>
      <div className="dot-grid" aria-hidden="true"></div>

      <div className="wrap">
        <TopBar
          accountId={miden.account.id}
          isBusy={miden.isBusy}
          isConnected={miden.isConnected}
          statusDetail={miden.error || miden.message}
          statusText={miden.message}
          theme={theme}
          onConnect={miden.connect}
          onCopyAddress={() => copyText(miden.account.id)}
          onDisconnect={miden.disconnect}
          onFund={miden.openFaucet}
          onSync={miden.sync}
          onSwitchWallet={miden.switchWallet}
          onToggleTheme={() => setTheme(toggleTheme)}
        />
        <WindowChrome title="midbid.auction.tsx" />
        <HeroPanel account={miden.account} />

        <main className="workspace auction-workspace" id="main">
          <section className="auction-main-column">
            <AuctionStudio
              canCreate={hasCreatorWallet}
              isBusy={miden.isBusy}
              onOpenCreate={handleOpenCreateAuction}
            />

            <AuctionSummary
              activeTab={auctionTab}
              auction={activeAuction}
              auctions={auctions}
              clock={clock}
              copied={copied}
              globalState={globalState}
              onCopyLink={copyAuctionLink}
              onDeleteAuction={handleDeleteAuction}
              onOpenAuction={handleOpenAuctionAction}
              onSelectAuction={setActiveAuctionId}
              onTabChange={setAuctionTab}
              summaryRef={auctionSummaryRef}
            />
          </section>
        </main>
      </div>

      <FeedbackOverlay
        operation={miden.operation}
        toast={miden.toast}
        onDismissToast={miden.dismissToast}
      />
      {createModalOpen && (
        <AuctionCreateModal
          connectedAccount={connectedSettlementAccount}
          isBusy={miden.isBusy}
          isConnected={hasCreatorWallet}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateAuction}
        />
      )}
      {bidModalOpen && (
        <BidModal
          amount={bidAmount}
          asset={miden.account.asset}
          assetOptions={miden.assetOptions}
          assetValue={miden.selectedAssetId}
          disabled={!miden.isConnected || !activeAuction || auctionClosed}
          hasAuction={Boolean(activeAuction)}
          isClosed={auctionClosed}
          isSending={miden.isBusy}
          preflight={bidPreflight}
          onAmountChange={setBidAmount}
          onAssetChange={miden.selectAsset}
          onClose={() => setBidModalOpen(false)}
          onSubmitBid={handleSubmitBid}
        />
      )}
      {settlementModalOpen && (
        <SettlementModal
          auction={activeAuction}
          globalState={globalState}
          isBusy={miden.isBusy}
          isClosed={auctionClosed}
          manualAmount={manualCandidateAmount}
          notes={miden.notes}
          onAddManualCandidate={handleAddManualCandidate}
          onManualAmountChange={setManualCandidateAmount}
          onClose={() => setSettlementModalOpen(false)}
          onConsume={handleConsumeBidNote}
          onRevealWinner={handleRevealWinner}
        />
      )}
    </div>
  )
}

function toggleTheme(current) {
  return current === 'dark' ? 'light' : 'dark'
}

async function copyText(value) {
  if (navigator.clipboard && value) {
    await navigator.clipboard.writeText(value)
  }
}

export default App

async function createAuctionRecord(draft) {
  const now = new Date().toISOString()
  const { auctionId, manifestHash } = await createAuctionManifest({ ...draft, createdAt: now })

  return {
    bids: [],
    bidPrivateKey: draft.bidPrivateKey || null,
    bidPublicKey: draft.bidPublicKey || null,
    brief: draft.brief || '',
    createdAt: now,
    creatorAccount: draft.creatorAccount || draft.settlementAccount || '',
    deadline: draft.deadline || formatAuctionDeadline(draft.endsAt),
    endsAt: draft.endsAt,
    id: auctionId,
    manifestHash,
    noteType: 'private',
    privacy: MIDBID_NOTE_MODE,
    protocolVersion: MIDBID_PROTOCOL_VERSION,
    reserve: draft.reserve || '',
    image: draft.image || '',
    imageName: draft.imageName || '',
    revealedAt: '',
    settlementAccount: draft.settlementAccount || '',
    settlementCandidates: [],
    status: 'pending',
    syncStatus: draft.syncStatus || 'local',
    timezone: draft.timezone || getLocalTimezone(),
    title: draft.title || 'Untitled sealed auction',
    updatedAt: now,
    vaultKind: draft.vaultKind || 'wallet',
  }
}

function revealHighestBid(auction, notes) {
  const candidates = [
    ...(auction.settlementCandidates || []).map((candidate) => ({
      amount: candidate.amount,
      asset: candidate.asset || 'MIDEN',
      bidder: candidate.bidder || 'private bidder',
      reference: candidate.reference || candidate.txId || candidate.noteId || candidate.id,
      source: 'claimed private note',
    })),
    ...notes.map((note) => ({
      amount: note.amount,
      asset: note.asset || 'MIDEN',
      bidder: note.from || 'private bidder',
      reference: note.id,
      source: 'visible private note',
    })),
  ]
    .filter((candidate) => candidate.amount)
    .map((candidate) => ({
      ...candidate,
      amountBaseUnits: parseMidenAmount(candidate.amount),
    }))
    .filter((candidate) => candidate.amountBaseUnits > 0n)
    .sort((left, right) => compareBigInt(right.amountBaseUnits, left.amountBaseUnits))

  const winner = candidates[0]

  if (!winner) return null

  return {
    amount: winner.amount,
    amountBaseUnits: winner.amountBaseUnits.toString(),
    asset: winner.asset,
    bidder: winner.bidder,
    reference: winner.reference,
    revealedAt: new Date().toISOString(),
    source: winner.source,
  }
}

function parseMidenAmount(value) {
  const normalized = String(value || '').trim().replaceAll(',', '')

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) return 0n

  const [whole, fraction = ''] = normalized.split('.')
  const paddedFraction = fraction.padEnd(6, '0').slice(0, 6)

  return BigInt(whole || '0') * 1_000_000n + BigInt(paddedFraction || '0')
}

function compareBigInt(left, right) {
  if (left > right) return 1
  if (left < right) return -1
  return 0
}

function createSettlementCandidate(note, txId) {
  const now = new Date().toISOString()

  return {
    amount: note.amount,
    asset: note.asset || 'MIDEN',
    bidder: note.from || 'private bidder',
    claimedAt: now,
    id: `claim_${note.id || Date.now().toString(16)}`,
    noteId: note.id || '',
    reference: txId || note.id || '',
    source: 'claimed private note',
    txId: txId || '',
  }
}

function addSettlementCandidate(candidates = [], candidate) {
  const existingKeys = new Set(
    candidates.map((item) => item.noteId || item.reference || item.txId || item.id).filter(Boolean),
  )
  const candidateKey = candidate.noteId || candidate.reference || candidate.txId || candidate.id

  if (candidateKey && existingKeys.has(candidateKey)) return candidates

  return [candidate, ...candidates]
}

function isAuctionCreator(auction, accountId) {
  const creator = normalizeAccountId(auction?.creatorAccount || auction?.settlementAccount)
  const actor = normalizeAccountId(accountId)

  return Boolean(creator && actor && creator === actor)
}

function isLikelyMidenAccount(value) {
  const accountId = String(value || '').trim()

  if (accountId.length < 12 || /\s/.test(accountId)) return false
  if (/^0x[0-9a-f]+$/i.test(accountId)) return accountId.length >= 16

  return /^m[a-z0-9_]{10,}$/i.test(accountId)
}

function normalizeAccountId(value) {
  return String(value || '').trim().toLowerCase()
}

function createInitialGlobalState() {
  if (getSupabaseMode() === 'global') {
    return {
      mode: 'global',
      message: 'Loading global auction registry...',
      status: 'syncing',
    }
  }

  return {
    mode: 'local',
    message: 'Add Supabase env keys to publish auctions globally.',
    status: 'local',
  }
}

function mergeGlobalAuctions(localAuctions, globalAuctions) {
  const byId = new Map()

  globalAuctions.forEach((auction) => {
    const localAuction = localAuctions.find((item) => item.id === auction.id)

    byId.set(auction.id, localAuction ? preserveLocalAuctionData(localAuction, auction) : auction)
  })

  localAuctions
    .filter((auction) => auction.syncStatus !== 'global' && !byId.has(auction.id))
    .forEach((auction) => byId.set(auction.id, auction))

  return Array.from(byId.values()).sort((left, right) => {
    const leftDate = new Date(left.createdAt || 0).getTime()
    const rightDate = new Date(right.createdAt || 0).getTime()

    return rightDate - leftDate
  })
}

function preserveLocalAuctionData(localAuction, syncedAuction) {
  return {
    ...localAuction,
    ...syncedAuction,
    bidPrivateKey: localAuction.bidPrivateKey || syncedAuction.bidPrivateKey || null,
    bidPublicKey: syncedAuction.bidPublicKey || localAuction.bidPublicKey || null,
    bids: localAuction.bids || syncedAuction.bids || [],
    creatorAccount: syncedAuction.creatorAccount || localAuction.creatorAccount || '',
    editToken: localAuction.editToken || syncedAuction.editToken || '',
    revealedAt: syncedAuction.revealedAt || localAuction.revealedAt || '',
    settlementCandidates: localAuction.settlementCandidates || syncedAuction.settlementCandidates || [],
    status:
      syncedAuction.status === 'revealed' || localAuction.status === 'revealed'
        ? 'revealed'
        : syncedAuction.status || localAuction.status || 'pending',
    syncStatus: syncedAuction.syncStatus || localAuction.syncStatus || 'local',
    winner: syncedAuction.winner || localAuction.winner || null,
  }
}

function getErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error')

  try {
    const parsed = JSON.parse(message)

    return parsed.message || parsed.error || message
  } catch {
    return message
  }
}

function readStoredAuctions() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(auctionStorageKey) || '[]')

    if (!Array.isArray(parsed)) return []

    return parsed.filter((item) => item && typeof item.id === 'string')
  } catch {
    return []
  }
}

function readStoredActiveAuctionId() {
  return globalThis.localStorage?.getItem('midbid:active-auction-id') || ''
}

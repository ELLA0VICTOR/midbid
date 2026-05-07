import { useMemo, useState } from 'react'

import { formatAuctionDeadline, shorten } from '../lib/formatUtils'

export function SettlementPanel({ auction, globalState, isClosed, notes, onRevealWinner }) {
  const hasResult = Boolean(auction?.winner)
  const revealCandidates = (auction?.settlementCandidates || []).filter(
    (candidate) => !isSelfBidCandidate(auction, candidate?.bidder),
  )
  const ignoredSelfBidCount = (auction?.settlementCandidates?.length || 0) - revealCandidates.length
  const visibleNotes = notes.filter((note) => !isSelfBidCandidate(auction, note?.from))
  const claimedCount = revealCandidates.length
  const visibleCount = visibleNotes.length
  const totalCandidateCount = claimedCount + visibleCount
  const disabled = !auction || !isClosed || totalCandidateCount === 0
  const [revealState, setRevealState] = useState({ auctionId: '', phase: 'idle' })
  const winnerAmount = hasResult ? `${auction.winner.amount} ${auction.winner.asset}` : ''
  const winnerReference = hasResult ? shorten(auction.winner.reference) : ''
  const syncLabel = getWinnerSyncLabel(auction, globalState)
  const candidateLabel = useMemo(
    () =>
      `${claimedCount} sealed ${claimedCount === 1 ? 'receipt' : 'receipts'} / ${visibleCount} visible notes${
        ignoredSelfBidCount ? ` / ${ignoredSelfBidCount} self ignored` : ''
      }`,
    [claimedCount, ignoredSelfBidCount, visibleCount],
  )
  const storedPhase = revealState.auctionId === auction?.id ? revealState.phase : ''
  const phase = storedPhase === 'revealing' ? 'revealing' : hasResult ? 'revealed' : storedPhase || 'idle'

  async function handleRevealClick() {
    if (disabled || phase === 'revealing') return

    setRevealState({ auctionId: auction.id, phase: 'revealing' })

    const didReveal = await onRevealWinner?.()

    window.setTimeout(() => {
      setRevealState({ auctionId: auction.id, phase: didReveal ? 'revealed' : 'idle' })
    }, didReveal ? 1450 : 450)
  }

  const showRevealAnimation = phase === 'revealing'
  const showWinner = hasResult && !showRevealAnimation

  return (
    <section className="panel settlement-panel" aria-labelledby="settlement-title">
      <div className="panel-heading compact">
        <div>
          <p className="panel-kicker">Settlement</p>
          <h2 id="settlement-title">Winner reveal</h2>
        </div>
      </div>

      {showRevealAnimation ? (
        <div className="reveal-stage is-revealing" aria-live="polite">
          <div className="reveal-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="reveal-core">
            <span className="reveal-pulse" aria-hidden="true" />
            <strong>Opening sealed bids</strong>
            <small>{candidateLabel}</small>
          </div>
          <div className="reveal-scanline" aria-hidden="true" />
        </div>
      ) : showWinner ? (
        <div className="winner-reveal-card" aria-live="polite">
          <div className="winner-reveal-topline">
            <span>Winner revealed</span>
            <small>{syncLabel}</small>
          </div>
          <strong className="winner-amount">{winnerAmount}</strong>
          <div className="winner-meta-grid">
            <div className="winner-meta">
              <span>Bidder</span>
              <strong title={auction.winner.bidder}>{shorten(auction.winner.bidder) || 'private bidder'}</strong>
            </div>
            <div className="winner-meta">
              <span>Reference</span>
              <strong title={auction.winner.reference}>{winnerReference || 'private note'}</strong>
            </div>
            <div className="winner-meta">
              <span>Source</span>
              <strong>{auction.winner.source || 'sealed private note'}</strong>
            </div>
            <div className="winner-meta">
              <span>Candidates</span>
              <strong>{totalCandidateCount}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="settlement-copy reveal-brief">
          <p>
            {auction
              ? isClosed
                ? 'Ready to open the sealed receipts. The reveal chooses the highest settlement candidate and publishes only the winning result.'
                : `Reveal unlocks after ${formatAuctionDeadline(auction.endsAt)}.`
              : 'Create an auction first.'}
          </p>
        </div>
      )}

      <div className="settlement-readout">
        <span>Settlement candidates</span>
        <strong>{totalCandidateCount}</strong>
        <small>
          {claimedCount} claimed / {visibleCount} visible{ignoredSelfBidCount ? ` / ${ignoredSelfBidCount} self ignored` : ''}
        </small>
      </div>

      {claimedCount > 0 && (
        <div className="candidate-list" aria-label="Claimed settlement candidates">
          {revealCandidates.slice(0, 4).map((candidate) => (
            <div className="candidate-row" key={candidate.id}>
              <span>{candidate.source || 'claimed private note'}</span>
              <strong>
                {candidate.amount} {candidate.asset}
              </strong>
              <small title={candidate.reference}>{shorten(candidate.reference) || 'local claim'}</small>
            </div>
          ))}
        </div>
      )}

      <button
        className="secondary-action reveal-action"
        type="button"
        disabled={disabled || phase === 'revealing'}
        onClick={handleRevealClick}
      >
        {phase === 'revealing' ? 'Revealing' : hasResult ? 'Reveal again' : 'Reveal winner'}
      </button>

      <p className="global-note">
        {getSettlementNote(auction, globalState)}
      </p>
    </section>
  )
}

function getSettlementNote(auction, globalState) {
  if (!auction) return 'Create an auction before publishing a global reveal.'
  if (globalState?.mode !== 'global') return 'Result stays local until Supabase env keys are added.'
  if (auction.winner && auction.syncStatus === 'global') return 'Result is synced for every MidBid visitor.'
  if (!auction.editToken) return 'Only the creator browser can publish the global reveal.'

  return 'Encrypted bid receipts load for the creator browser. Creator self-bids are ignored during reveal.'
}

function getWinnerSyncLabel(auction, globalState) {
  if (!auction?.winner) return ''
  if (auction.syncStatus === 'global') return 'Synced globally'
  if (globalState?.mode === 'global' && globalState?.status === 'error') return 'Saved locally'

  return 'Local reveal'
}

function isSelfBidCandidate(auction, bidderValue) {
  const bidder = normalizeAccountId(bidderValue)
  const creator = normalizeAccountId(auction?.creatorAccount || auction?.settlementAccount)
  const settlement = normalizeAccountId(auction?.settlementAccount)

  return Boolean(bidder && (bidder === creator || bidder === settlement))
}

function normalizeAccountId(value) {
  return String(value || '').trim().toLowerCase()
}

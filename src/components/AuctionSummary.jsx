import { IconCopy } from './icons'
import {
  formatAuctionDeadline,
  formatTimeRemaining,
  getLocalTimezone,
  isAuctionClosed,
  shorten,
} from '../lib/formatUtils'
import { getAuctionProtocolLabel, getAuctionVaultLabel } from '../lib/midbidProtocol'

export function AuctionSummary({
  activeTab,
  auction,
  auctions,
  clock,
  copied,
  globalState,
  onCopyLink,
  onDeleteAuction,
  onOpenAuction,
  onSelectAuction,
  onTabChange,
  summaryRef,
}) {
  const pendingAuctions = auctions.filter((item) => !isAuctionClosed(item.endsAt, clock))
  const closedAuctions = auctions.filter((item) => isAuctionClosed(item.endsAt, clock))
  const visibleAuctions = activeTab === 'closed' ? closedAuctions : pendingAuctions
  const visibleAuction = visibleAuctions.find((item) => item.id === auction?.id) || visibleAuctions[0] || null

  return (
    <section className="panel auction-summary" aria-labelledby="summary-title" ref={summaryRef}>
      <div className="panel-heading compact">
        <div>
          <p className="panel-kicker">Created auctions</p>
          <h2 id="summary-title">{visibleAuction?.title || 'No auction yet'}</h2>
        </div>
      </div>

      <div className="auction-tabs" role="tablist" aria-label="Auction status">
        <TabButton
          active={activeTab === 'pending'}
          count={pendingAuctions.length}
          label="pending"
          onClick={() => onTabChange('pending')}
        />
        <TabButton
          active={activeTab === 'closed'}
          count={closedAuctions.length}
          label="closed"
          onClick={() => onTabChange('closed')}
        />
      </div>

      {visibleAuction ? (
        <>
          {visibleAuctions.length > 1 && (
            <div className="auction-picker" aria-label="Auction selector">
              {visibleAuctions.map((item) => (
                <button
                  className={item.id === auction.id ? 'active' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => onSelectAuction(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}

          <AuctionCard auction={visibleAuction} clock={clock} globalState={globalState} onOpenAuction={onOpenAuction} />

          <div className="auction-summary-actions">
            <button className="secondary-action" type="button" onClick={() => onCopyLink(visibleAuction)}>
              <IconCopy />
              <span>{copied ? 'Copied' : 'Copy auction link'}</span>
            </button>
            <button className="secondary-action danger-action" type="button" onClick={() => onDeleteAuction(visibleAuction)}>
              Delete auction
            </button>
          </div>
        </>
      ) : (
        <div className="empty-line">No {activeTab} auctions yet</div>
      )}
    </section>
  )
}

function getRegistryLabel(auction, globalState) {
  if (globalState?.mode !== 'global') return 'local only'
  if (globalState.status === 'syncing') return 'syncing'
  if (auction.syncStatus === 'global') return 'global'
  if (globalState.status === 'error') return 'local saved'

  return 'local draft'
}

function AuctionCard({ auction, clock, globalState, onOpenAuction }) {
  const status = isAuctionClosed(auction.endsAt, clock) ? 'closed' : 'pending'
  const isClosed = status === 'closed'

  function handleOpenAuction() {
    onOpenAuction?.(auction)
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onOpenAuction?.(auction)
  }

  return (
    <article
      aria-label={isClosed ? `Open settlement for ${auction.title}` : `Open private bid for ${auction.title}`}
      className="created-auction-card is-actionable"
      role="button"
      tabIndex={0}
      onClick={handleOpenAuction}
      onKeyDown={handleKeyDown}
    >
      <div className="created-auction-head">
        <div className={`created-auction-thumb ${auction.image ? 'has-image' : ''}`} aria-hidden="true">
          {auction.image ? <img alt="" src={auction.image} /> : <span>{auction.title.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="created-auction-title">
          <span>
            {status} / {getRegistryLabel(auction, globalState)} / {isClosed ? 'tap to settle' : 'tap to bid'}
          </span>
          <h3>{auction.title}</h3>
          <p>{auction.brief || 'Private sealed bids route through Miden notes to the settlement account.'}</p>
        </div>
      </div>

      <div className="created-auction-countdown">
        <span>Time left</span>
        <strong>{formatTimeRemaining(auction.endsAt, clock)}</strong>
        <small title={`${formatAuctionDeadline(auction.endsAt)} ${getLocalTimezone()}`}>
          {formatAuctionDeadline(auction.endsAt)}
        </small>
      </div>

      <div className="created-auction-grid">
        <AuctionCardCell label="Reserve" value={`${auction.reserve || '0'} MIDEN`} />
        <AuctionCardCell label="Claimed bids" value={String(auction.settlementCandidates?.length || 0)} />
        <AuctionCardCell label="Result" title={auction.winner?.reference} value={getResultLabel(auction)} />
        <AuctionCardCell
          label="Registry"
          title={globalState?.message}
          value={getRegistryLabel(auction, globalState)}
        />
        <AuctionCardCell label="Vault" value={getAuctionVaultLabel(auction)} />
        <AuctionCardCell label="Protocol" value={getAuctionProtocolLabel(auction)} />
        <AuctionCardCell
          label="Account"
          title={auction.settlementAccount}
          value={shorten(auction.settlementAccount) || 'Connect wallet'}
        />
        <AuctionCardCell
          label="Manifest"
          title={auction.manifestHash}
          value={auction.manifestHash ? shorten(`0x${auction.manifestHash}`) : 'pending'}
        />
      </div>
    </article>
  )
}

function AuctionCardCell({ label, title, value }) {
  return (
    <div className="auction-card-cell">
      <span>{label}</span>
      <strong title={title || value}>{value}</strong>
    </div>
  )
}

function getResultLabel(auction) {
  if (!auction.winner) return 'not revealed'

  return `${auction.winner.amount} ${auction.winner.asset}`
}

function TabButton({ active, count, label, onClick }) {
  return (
    <button
      className={active ? 'active' : ''}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
    >
      {label}
      <span>{count}</span>
    </button>
  )
}

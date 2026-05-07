import { BidAction } from './BidAction'

export function BidModal({
  amount,
  asset,
  assetOptions,
  assetValue,
  disabled,
  hasAuction,
  isClosed,
  isSending,
  preflight,
  onAmountChange,
  onAssetChange,
  onClose,
  onSubmitBid,
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="bid-modal-title"
        aria-modal="true"
        className="auction-create-modal bid-modal"
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <p className="panel-kicker">Miden private note</p>
            <h2 id="bid-modal-title">Submit private bid</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <BidAction
          amount={amount}
          asset={asset}
          assetOptions={assetOptions}
          assetValue={assetValue}
          disabled={disabled}
          hasAuction={hasAuction}
          isClosed={isClosed}
          isSending={isSending}
          preflight={preflight}
          onAmountChange={onAmountChange}
          onAssetChange={onAssetChange}
          onSubmitBid={onSubmitBid}
        />
      </section>
    </div>
  )
}

import { IconBid } from './icons'
import { Field } from './ui'

export function BidAction({
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
  onSubmitBid,
}) {
  const buttonLabel = getSubmitLabel({ disabled, hasAuction, isClosed, isSending, preflight })

  return (
    <section className="panel bid-action" aria-labelledby="bid-action-title">
      <div className="panel-heading compact">
        <div>
          <p className="panel-kicker">Wallet</p>
          <h2 id="bid-action-title">Submit private bid</h2>
        </div>
      </div>

      <form className="bid-action-form" onSubmit={onSubmitBid}>
        <Field label="Bid amount">
          <input
            value={amount}
            inputMode="decimal"
            onChange={(event) => onAmountChange(event.target.value)}
          />
        </Field>

        <Field label="Asset">
          <select value={assetValue || asset} onChange={(event) => onAssetChange?.(event.target.value)}>
            {assetOptions.map((option) => (
              <option key={getOptionValue(option)} value={getOptionValue(option)}>
                {getOptionLabel(option)}
              </option>
            ))}
          </select>
        </Field>

        <p className={`compact-preflight ${preflight.ready ? 'ready' : 'blocked'}`}>
          {preflight.ready ? 'Ready for wallet approval' : preflight.summary}
        </p>

        <button className="primary-action" type="submit" disabled={disabled || isSending}>
          <IconBid />
          <span>{buttonLabel}</span>
        </button>
      </form>
    </section>
  )
}

function getSubmitLabel({ disabled, hasAuction, isClosed, isSending, preflight }) {
  if (!hasAuction) return 'Create auction'
  if (isClosed) return 'Auction closed'
  if (isSending) return 'Proving'
  if (disabled && preflight?.items?.some((item) => item.label === 'Wallet connected' && !item.ok)) {
    return 'Connect wallet'
  }
  if (disabled) return 'Cannot bid'

  return 'Submit bid'
}

function getOptionValue(option) {
  return typeof option === 'string' ? option : option.value
}

function getOptionLabel(option) {
  return typeof option === 'string' ? option : option.label
}

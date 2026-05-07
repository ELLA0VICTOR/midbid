import { PrivateInbox } from './PrivateInbox'
import { SettlementPanel } from './SettlementPanel'

export function SettlementModal({
  auction,
  globalState,
  isBusy,
  isClosed,
  manualAmount,
  notes,
  onAddManualCandidate,
  onClose,
  onConsume,
  onManualAmountChange,
  onRevealWinner,
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="settlement-modal-title"
        aria-modal="true"
        className="auction-create-modal settlement-modal"
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <p className="panel-kicker">Closed auction</p>
            <h2 id="settlement-modal-title">Settle auction</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="settlement-modal-grid">
          <SettlementPanel
            auction={auction}
            globalState={globalState}
            isClosed={isClosed}
            notes={notes}
            onRevealWinner={onRevealWinner}
          />
          <form className="manual-candidate-form" onSubmit={onAddManualCandidate}>
            <label className="field">
              <span>Record received bid</span>
              <input
                inputMode="decimal"
                placeholder="10"
                value={manualAmount}
                onChange={(event) => onManualAmountChange(event.target.value)}
              />
            </label>
            <button className="secondary-action" type="submit" disabled={isBusy || !manualAmount?.trim()}>
              Add settlement candidate
            </button>
          </form>
          <PrivateInbox isBusy={isBusy} notes={notes} onConsume={onConsume} />
        </div>
      </section>
    </div>
  )
}

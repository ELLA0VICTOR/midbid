import { PrivateInbox } from './PrivateInbox'
import { SettlementPanel } from './SettlementPanel'

export function SettlementModal({
  auction,
  globalState,
  isBusy,
  isClosed,
  notes,
  onClose,
  onConsume,
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
          <PrivateInbox isBusy={isBusy} notes={notes} onConsume={onConsume} />
        </div>
      </section>
    </div>
  )
}

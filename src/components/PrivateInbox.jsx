import { shorten } from '../lib/formatUtils'

export function PrivateInbox({ isBusy, notes, onConsume }) {
  return (
    <section className="panel private-inbox" aria-labelledby="private-inbox-title">
      <div className="panel-heading compact">
        <div>
          <p className="panel-kicker">Private inbox</p>
          <h2 id="private-inbox-title">Claim bid notes</h2>
        </div>
      </div>

      <div className="inbox-list">
        {notes.length > 0 ? (
          notes.slice(0, 4).map((note) => (
            <div className="inbox-row" key={note.id}>
              <div>
                <span>{shorten(note.id)}</span>
                <strong>
                  {note.amount} {note.asset}
                </strong>
                <small>{note.privacy} note</small>
              </div>
              <button type="button" disabled={isBusy} onClick={() => onConsume(note.id)}>
                Claim
              </button>
            </div>
          ))
        ) : (
          <div className="empty-line">No claimable bid notes</div>
        )}
      </div>
    </section>
  )
}

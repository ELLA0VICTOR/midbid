export function FeedbackOverlay({ operation, toast, onDismissToast }) {
  return (
    <>
      {operation && (
        <div className="operation-modal" role="status" aria-live="polite" aria-label={operation.title}>
          <div className="operation-box">
            <span className="operation-spinner" aria-hidden="true"></span>
            <div>
              <p className="panel-kicker">Miden action</p>
              <h2>{operation.title}</h2>
              <p>{operation.detail}</p>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.detail}</span>
          </div>
          <button type="button" aria-label="Dismiss notification" onClick={onDismissToast}>
            Dismiss
          </button>
        </div>
      )}
    </>
  )
}

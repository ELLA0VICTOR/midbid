export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function DataLine({ className = '', label, title, value }) {
  return (
    <div className={`data-line ${className}`}>
      <span>{label}</span>
      <strong title={title || (typeof value === 'string' ? value : undefined)}>{value}</strong>
    </div>
  )
}

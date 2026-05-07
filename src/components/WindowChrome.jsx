export function WindowChrome({ title }) {
  return (
    <div className="window-chrome" aria-hidden="true">
      <span className="window-dot dot-red"></span>
      <span className="window-dot dot-amber"></span>
      <span className="window-dot dot-green"></span>
      <span className="window-title">{title}</span>
    </div>
  )
}

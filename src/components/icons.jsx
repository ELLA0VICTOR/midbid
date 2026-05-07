export function StatusDot() {
  return <span className="status-dot" aria-hidden="true"></span>
}

export function AppMark() {
  return (
    <span className="app-mark" aria-hidden="true">
      <svg viewBox="0 0 72 72" role="presentation">
        <rect className="mark-face" x="9" y="9" width="54" height="54" rx="15"></rect>
        <path className="mark-symbol" d="M22 28l9-9 18 18-9 9-18-18Z"></path>
        <path className="mark-symbol" d="M29 21l18 18"></path>
        <path className="mark-accent" d="M39 44l12 12"></path>
        <path className="mark-symbol" d="M23 53h24"></path>
        <path className="mark-symbol" d="M28 47h14"></path>
        <circle className="mark-node" cx="51" cy="56" r="2.6"></circle>
      </svg>
    </span>
  )
}

export function IconLock() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="4" y="8" width="12" height="9" rx="2"></rect>
      <path d="M7 8V6a3 3 0 0 1 6 0v2"></path>
    </svg>
  )
}

export function IconSend() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 10 17 3l-4 14-3-5-5-2Z"></path>
      <path d="m10 12 3-4"></path>
    </svg>
  )
}

export function IconQr() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="panel-icon">
      <path d="M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3z"></path>
      <path d="M12 12h2v2h-2zM15 12h2v5h-2zM12 15h2v2h-2z"></path>
    </svg>
  )
}

export function IconCopy() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="7" y="7" width="9" height="9" rx="2"></rect>
      <path d="M4 13V5a1 1 0 0 1 1-1h8"></path>
    </svg>
  )
}

export function IconRefresh() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M16 7a6 6 0 0 0-10.4-2.8L4 6"></path>
      <path d="M4 2v4h4"></path>
      <path d="M4 13a6 6 0 0 0 10.4 2.8L16 14"></path>
      <path d="M16 18v-4h-4"></path>
    </svg>
  )
}

export function IconBid() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 14h10"></path>
      <path d="M7 5h6l3 4-6 6-6-6 3-4Z"></path>
      <path d="M8 9h4"></path>
    </svg>
  )
}

export function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="4" width="14" height="13" rx="2"></rect>
      <path d="M7 2v4M13 2v4M3 8h14"></path>
      <path d="M7 11h2M11 11h2M7 14h2"></path>
    </svg>
  )
}

export function shorten(value) {
  if (!value || value.length < 14) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

export function buildAuctionLink({ account, auction, selectedAsset }) {
  const params = new URLSearchParams({
    id: auction.id || '',
    auction: auction.title || 'sealed auction',
    seller: auction.settlementAccount || account.id,
    reserve: auction.reserve || '0',
    asset: selectedAsset?.faucetId || account.asset,
    deadline: auction.endsAt || auction.deadline || 'open',
    manifest: auction.manifestHash || '',
    mode: 'private-note',
    protocol: auction.protocolVersion || 'midbid-sealed-v1',
    timezone: auction.timezone || getLocalTimezone(),
  })

  if (auction.brief) {
    params.set('brief', auction.brief)
  }

  if (auction.winner) {
    params.set('result', 'revealed')
    params.set('winningAmount', auction.winner.amount)
    params.set('winner', auction.winner.bidder || 'private bidder')
    params.set('winnerReference', auction.winner.reference || '')
    params.set('revealedAt', auction.winner.revealedAt || auction.revealedAt || '')
  }

  return `midbid://auction?${params.toString()}`
}

export function getDisplayTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
}

export function toDateTimeInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)

  return local.toISOString().slice(0, 16)
}

export function getDefaultAuctionEnd() {
  const date = new Date()
  date.setHours(date.getHours() + 48)

  return toDateTimeInputValue(date)
}

export function addHoursToDateTime(hours) {
  const date = new Date()
  date.setHours(date.getHours() + hours)

  return toDateTimeInputValue(date)
}

export function getNextWeekdayDateTime(targetDay) {
  const date = new Date()
  const currentDay = date.getDay()
  const distance = (targetDay - currentDay + 7) % 7 || 7

  date.setDate(date.getDate() + distance)
  date.setHours(17, 0, 0, 0)

  return toDateTimeInputValue(date)
}

export function formatAuctionDeadline(value) {
  if (!value) return 'Open'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatTimeRemaining(value, now = Date.now()) {
  if (!value) return 'Open'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Open'

  const nowMs = now instanceof Date ? now.getTime() : Number(now)
  const remainingMs = date.getTime() - nowMs

  if (remainingMs <= 0) return 'Closed'

  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`

  return `${seconds}s`
}

export function isAuctionClosed(value, now = Date.now()) {
  if (!value) return false

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return false

  const nowMs = now instanceof Date ? now.getTime() : Number(now)

  return date.getTime() <= nowMs
}

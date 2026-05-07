import { getLocalTimezone } from './formatUtils'

export const MIDBID_PROTOCOL_VERSION = 'midbid-sealed-v1'
export const MIDBID_NOTE_MODE = 'private-note'

export async function createAuctionManifest(draft) {
  const createdAt = draft.createdAt || new Date().toISOString()
  const manifest = {
    createdAt,
    endsAt: draft.endsAt || '',
    privacy: MIDBID_NOTE_MODE,
    protocol: MIDBID_PROTOCOL_VERSION,
    reserve: normalizeAmount(draft.reserve),
    settlementAccount: draft.settlementAccount || '',
    timezone: draft.timezone || getLocalTimezone(),
    title: draft.title || 'Untitled sealed auction',
  }
  const manifestHash = await sha256Hex(stableStringify(manifest))

  return {
    auctionId: `mbid_${manifestHash.slice(0, 14)}`,
    manifest,
    manifestHash,
  }
}

export async function createBidSeal({ amount, asset, auction, bidder }) {
  const salt = randomHex(24)
  const privatePayload = {
    amount: normalizeAmount(amount),
    asset: asset?.faucetId || asset?.symbol || 'MIDEN',
    auctionId: auction.id,
    bidder,
    createdAt: new Date().toISOString(),
    manifestHash: auction.manifestHash || '',
    protocol: MIDBID_PROTOCOL_VERSION,
    salt,
  }
  const commitment = await sha256Hex(stableStringify(privatePayload))

  return {
    commitment,
    commitmentShort: `0x${commitment.slice(0, 10)}...${commitment.slice(-8)}`,
    privacy: MIDBID_NOTE_MODE,
    protocol: MIDBID_PROTOCOL_VERSION,
  }
}

export function getAuctionProtocolLabel(auction) {
  if (!auction) return MIDBID_PROTOCOL_VERSION

  return auction.protocolVersion || MIDBID_PROTOCOL_VERSION
}

export function getAuctionVaultLabel(auction) {
  if (!auction?.settlementAccount) return 'Connect wallet'

  return auction.vaultKind === 'dedicated' ? 'Dedicated account' : 'Wallet account'
}

function normalizeAmount(value) {
  const normalized = String(value || '0').trim().replaceAll(',', '')

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) return '0'

  const [whole, fraction = ''] = normalized.split('.')
  const trimmedFraction = fraction.replace(/0+$/, '')

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

async function sha256Hex(value) {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)

    return bytesToHex(new Uint8Array(digest))
  }

  return fallbackHash(value)
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function randomHex(bytesLength) {
  const bytes = new Uint8Array(bytesLength)

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  return bytesToHex(bytes)
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fallbackHash(value) {
  let hashA = 0x811c9dc5
  let hashB = 0x45d9f3b

  for (let index = 0; index < value.length; index += 1) {
    hashA ^= value.charCodeAt(index)
    hashA = Math.imul(hashA, 0x01000193)
    hashB ^= hashA
    hashB = Math.imul(hashB, 0x85ebca6b)
  }

  return `${(hashA >>> 0).toString(16).padStart(8, '0')}${(hashB >>> 0)
    .toString(16)
    .padStart(8, '0')}`.repeat(4)
}

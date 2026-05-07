import { MIDBID_NOTE_MODE, MIDBID_PROTOCOL_VERSION } from './midbidProtocol'

const supabaseUrl = normalizeUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

export function getSupabaseMode() {
  return isSupabaseConfigured() ? 'global' : 'local'
}

export async function fetchGlobalAuctions() {
  if (!isSupabaseConfigured()) return []

  const rows = await supabaseRequest(
    'midbid_auctions?select=*&order=created_at.desc',
    {
      method: 'GET',
    },
  )

  return rows.map((row) => mapRowToAuction(row))
}

export async function fetchGlobalBidReceipts(auctionId) {
  if (!isSupabaseConfigured() || !auctionId) return []

  return supabaseRequest(
    `midbid_bid_receipts?select=*&auction_id=eq.${encodeURIComponent(auctionId)}&order=created_at.desc`,
    {
      method: 'GET',
    },
  )
}

export async function publishGlobalAuction(auction) {
  if (!isSupabaseConfigured()) return auction

  const editToken = auction.editToken || randomHex(24)
  const row = mapAuctionToRow({
    ...auction,
    editToken,
    editTokenHash: await sha256Hex(editToken),
  })

  const [createdRow] = await supabaseRequest('midbid_auctions', {
    method: 'POST',
    body: JSON.stringify(row),
    headers: {
      Prefer: 'return=representation',
    },
  })

  return {
    ...mapRowToAuction(createdRow),
    bidPrivateKey: auction.bidPrivateKey || null,
    bids: auction.bids || [],
    editToken,
    settlementCandidates: auction.settlementCandidates || [],
    syncStatus: 'global',
  }
}

export async function publishGlobalReveal(auction, winner, actorAccount) {
  if (!isSupabaseConfigured() || !auction.editToken) return null

  const updatedRow = await supabaseRequest('rpc/reveal_midbid_auction', {
    method: 'POST',
    body: JSON.stringify({
      p_actor_account: actorAccount || '',
      p_auction_id: auction.id,
      p_edit_token: auction.editToken,
      p_winner: winner,
    }),
  })

  return {
    ...mapRowToAuction(updatedRow),
    bidPrivateKey: auction.bidPrivateKey || null,
    bids: auction.bids || [],
    editToken: auction.editToken,
    settlementCandidates: auction.settlementCandidates || [],
    syncStatus: 'global',
  }
}

export async function publishGlobalBidReceipt({ auction, bidRecord, encryptedPayload }) {
  if (!isSupabaseConfigured() || !auction?.id || !encryptedPayload) return null

  const [createdRow] = await supabaseRequest('midbid_bid_receipts', {
    method: 'POST',
    body: JSON.stringify({
      auction_id: auction.id,
      commitment: bidRecord.commitment,
      encrypted_payload: encryptedPayload,
      id: bidRecord.id,
    }),
    headers: {
      Prefer: 'return=representation',
    },
  })

  return createdRow
}

export async function deleteGlobalAuction(auction, actorAccount) {
  if (!isSupabaseConfigured() || !auction.editToken) return null

  return supabaseRequest('rpc/delete_midbid_auction', {
    method: 'POST',
    body: JSON.stringify({
      p_actor_account: actorAccount || '',
      p_auction_id: auction.id,
      p_edit_token: auction.editToken,
    }),
  })
}

function mapAuctionToRow(auction) {
  return {
    brief: auction.brief || '',
    created_at: auction.createdAt || new Date().toISOString(),
    edit_token_hash: auction.editTokenHash,
    ends_at: toIsoDate(auction.endsAt),
    id: auction.id,
    image_data_url: auction.image || '',
    image_name: auction.imageName || '',
    bid_public_key: auction.bidPublicKey || null,
    creator_account: auction.creatorAccount || auction.settlementAccount || '',
    manifest_hash: auction.manifestHash || '',
    privacy: auction.privacy || MIDBID_NOTE_MODE,
    protocol_version: auction.protocolVersion || MIDBID_PROTOCOL_VERSION,
    reserve: auction.reserve || '0',
    settlement_account: auction.settlementAccount || '',
    status: auction.status || 'pending',
    timezone: auction.timezone || '',
    title: auction.title || 'Untitled sealed auction',
    updated_at: auction.updatedAt || new Date().toISOString(),
    vault_kind: auction.vaultKind || 'wallet',
    winner: auction.winner || null,
  }
}

function mapRowToAuction(row) {
  return {
    bids: [],
    brief: row.brief || '',
    createdAt: row.created_at || '',
    deadline: row.ends_at || '',
    endsAt: row.ends_at || '',
    id: row.id,
    image: row.image_data_url || '',
    imageName: row.image_name || '',
    bidPublicKey: row.bid_public_key || null,
    creatorAccount: row.creator_account || row.settlement_account || '',
    manifestHash: row.manifest_hash || '',
    noteType: 'private',
    privacy: row.privacy || MIDBID_NOTE_MODE,
    protocolVersion: row.protocol_version || MIDBID_PROTOCOL_VERSION,
    reserve: row.reserve || '0',
    revealedAt: row.revealed_at || '',
    settlementAccount: row.settlement_account || '',
    status: row.status || 'pending',
    settlementCandidates: [],
    syncStatus: 'global',
    timezone: row.timezone || '',
    title: row.title || 'Untitled sealed auction',
    updatedAt: row.updated_at || row.created_at || '',
    vaultKind: row.vault_kind || 'wallet',
    winner: row.winner || null,
  }
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Supabase request failed with ${response.status}`)
  }

  if (response.status === 204) return null

  return response.json()
}

function toIsoDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return new Date().toISOString()

  return date.toISOString()
}

function normalizeUrl(value) {
  return String(value || '').replace(/\/+$/, '')
}

async function sha256Hex(value) {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)

    return bytesToHex(new Uint8Array(digest))
  }

  return fallbackHash(value)
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

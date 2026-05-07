import {
  AllowedPrivateData,
  ConsumeTransaction,
  PrivateDataPermission,
  SendTransaction,
  WalletAdapterNetwork,
  WalletReadyState,
} from '@miden-sdk/miden-wallet-adapter-base'
import { MidenWalletAdapter } from '@miden-sdk/miden-wallet-adapter-miden'
import { shorten } from './formatUtils'

const APP_NAME = 'MidBid'
const FALLBACK_ASSET = {
  amount: '0',
  displayAmount: '0.00',
  faucetId: '',
  label: 'wallet asset',
  symbol: 'MIDEN',
}
const MIDEN_DECIMALS = 6

let walletAdapter

export function getMidenWalletAdapter() {
  if (!walletAdapter) {
    walletAdapter = new MidenWalletAdapter({ appName: APP_NAME })
  }

  return walletAdapter
}

export async function connectExtensionWallet() {
  const adapter = getMidenWalletAdapter()

  if (hasInjectedWallet()) {
    adapter.readyState = WalletReadyState.Installed
  }

  if (adapter.readyState !== WalletReadyState.Installed) {
    throw new Error('Miden Wallet extension was not detected. Install or enable the extension, then refresh this page.')
  }

  await adapter.connect(
    PrivateDataPermission.Auto,
    WalletAdapterNetwork.Testnet,
    AllowedPrivateData.All,
  )

  return adapter
}

export async function disconnectExtensionWallet(adapter = getMidenWalletAdapter()) {
  if (adapter?.connected) {
    await adapter.disconnect()
  }
}

export async function reconnectExtensionWallet(adapter = getMidenWalletAdapter()) {
  await disconnectExtensionWallet(adapter)
  return connectExtensionWallet()
}

export async function readExtensionDashboard(adapter, selectedFaucetId = '') {
  const [assets, notes] = await Promise.all([
    safeCall(() => adapter.requestAssets(), []),
    safeCall(() => adapter.requestConsumableNotes(), []),
  ])
  const walletAssets = formatAssets(assets)
  const selectedAsset = walletAssets.find((asset) => asset.faucetId === selectedFaucetId)
  const primaryAsset =
    selectedAsset || walletAssets.find((asset) => toBigInt(asset.amount) > 0n) || walletAssets[0] || FALLBACK_ASSET

  return {
    account: {
      alias: 'Miden extension wallet',
      asset: primaryAsset.symbol,
      balance: primaryAsset.displayAmount,
      id: getActiveWalletAddress() || adapter.address,
      mode: 'Extension / testnet',
    },
    activity: [],
    notes: formatNotes(notes),
    primaryAsset,
    syncHeight: 0,
    walletAssets,
  }
}

export async function submitExtensionBidNote(adapter, { amount, asset, noteType, recipient }) {
  if (!asset?.faucetId) {
    throw new Error('No Miden wallet asset is available to send yet. Fund the extension wallet first.')
  }

  const amountNumber = toSafeAmountNumber(amount)
  const transaction = new SendTransaction(
    getActiveWalletAddress() || adapter.address,
    recipient.trim(),
    asset.faucetId,
    noteType === 'public' ? 'public' : 'private',
    amountNumber,
  )

  return adapter.requestSend(transaction)
}

export async function waitForExtensionTransaction(adapter, txId, timeout = 120_000) {
  if (!txId || typeof adapter.waitForTransaction !== 'function') return null

  return adapter.waitForTransaction(txId, timeout)
}

export async function consumeExtensionNote(adapter, note) {
  if (!note?.faucetId) {
    throw new Error('This note is missing faucet details, so the wallet cannot consume it yet.')
  }

  const transaction = new ConsumeTransaction(
    note.faucetId,
    note.id,
    note.privacy === 'public' ? 'public' : 'private',
    toSafeAmountNumber(note.amount),
  )

  return adapter.requestConsume(transaction)
}

export async function createExtensionAuctionAccount(adapter) {
  if (typeof adapter?.createAccount !== 'function') {
    throw new Error('This Miden wallet does not expose account creation to dApps yet.')
  }

  return adapter.createAccount({
    accountType: 'RegularAccountImmutableCode',
    storageMode: 'public',
  })
}

export function getInstallUrl() {
  return getMidenWalletAdapter().url
}

export function getActiveWalletAddress() {
  return getInjectedWallet()?.address || getMidenWalletAdapter().address || ''
}

export function onExtensionAccountChange(callback) {
  const wallet = getInjectedWallet()

  if (!wallet?.on) return () => {}

  const handler = (...args) => {
    const nextAddress = extractAddress(args) || getActiveWalletAddress()
    callback(nextAddress)
  }

  wallet.on('accountChange', handler)
  wallet.on('connect', handler)

  return () => {
    wallet.off?.('accountChange', handler)
    wallet.off?.('connect', handler)
  }
}

function hasInjectedWallet() {
  return Boolean(getInjectedWallet())
}

function getInjectedWallet() {
  return globalThis.window?.midenWallet || globalThis.window?.miden
}

function extractAddress(args) {
  const value = args.find((item) => typeof item === 'string' && item.length > 10)

  if (value) return value

  const objectValue = args.find((item) => item && typeof item === 'object' && typeof item.address === 'string')

  return objectValue?.address || ''
}

function formatAssets(assets) {
  return assets.map((asset, index) => {
    const faucetId = asset.faucetId || ''
    const amount = String(asset.amount || '0')
    const symbol = index === 0 ? 'MIDEN' : faucetId ? shorten(faucetId) : `asset ${index + 1}`

    return {
      amount,
      displayAmount: formatMidenUnits(amount),
      faucetId,
      label: faucetId ? shorten(faucetId) : symbol,
      optionLabel: `${symbol} / ${formatMidenUnits(amount)}`,
      symbol,
    }
  })
}

function formatNotes(notes) {
  return notes.map((note) => {
    const asset = note.assets?.[0] || FALLBACK_ASSET
    const privacy = Number(note.noteType) === 1 ? 'public' : 'private'

    return {
      amount: formatMidenUnits(asset.amount),
      asset: 'MIDEN',
      faucetId: asset.faucetId,
      from: note.senderAccountId || 'private sender',
      id: note.noteId,
      memo: `${privacy} auction note`,
      privacy,
      status: 'ready',
    }
  })
}

function formatMidenUnits(value) {
  const normalized = String(value || '0')

  if (!/^\d+$/.test(normalized)) return normalized

  const amount = BigInt(normalized)
  const divisor = 10n ** BigInt(MIDEN_DECIMALS)
  const whole = amount / divisor
  const fraction = amount % divisor
  const fractionText = fraction.toString().padStart(MIDEN_DECIMALS, '0').slice(0, 2)

  return `${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fractionText}`
}

function toSafeAmountNumber(value) {
  const normalized = String(value || '').trim().replaceAll(',', '')

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error('Enter a MIDEN amount with up to 6 decimals.')
  }

  const amount = toBaseUnits(normalized)

  if (amount <= 0n) {
    throw new Error('Amount must be greater than zero.')
  }

  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Amount is too large for the current wallet adapter request format.')
  }

  return Number(amount)
}

function toBaseUnits(value) {
  const [whole, fraction = ''] = String(value).split('.')
  const paddedFraction = fraction.padEnd(MIDEN_DECIMALS, '0').slice(0, MIDEN_DECIMALS)

  return BigInt(whole || '0') * 10n ** BigInt(MIDEN_DECIMALS) + BigInt(paddedFraction || '0')
}

function toBigInt(value) {
  const normalized = String(value || '0').replaceAll(',', '')

  if (!/^\d+$/.test(normalized)) return 0n

  return BigInt(normalized)
}

async function safeCall(fn, fallback) {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

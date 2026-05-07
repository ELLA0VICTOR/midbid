import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connectExtensionWallet,
  consumeExtensionNote,
  createExtensionAuctionAccount,
  disconnectExtensionWallet,
  getActiveWalletAddress,
  readExtensionDashboard,
  reconnectExtensionWallet,
  submitExtensionBidNote,
  onExtensionAccountChange,
  waitForExtensionTransaction,
} from '../lib/midenExtensionWallet'
import { getDisplayTime, shorten } from '../lib/formatUtils'

const disconnectedAccount = {
  alias: 'not connected',
  asset: 'wallet asset',
  balance: '0',
  id: 'connect extension',
  mode: 'Miden wallet',
}

const sendLifecycle = ['Preflight', 'Wallet approval', 'Submitted', 'Confirmed']
const consumeLifecycle = ['Note selected', 'Wallet approval', 'Submitted', 'Confirmed']
const faucetUrl = 'https://faucet.testnet.miden.io/'

export function useMidenPay() {
  const busyRef = useRef(false)
  const selectedFaucetIdRef = useRef('')
  const toastTimerRef = useRef(null)
  const walletAdapterRef = useRef(null)
  const [account, setAccount] = useState(disconnectedAccount)
  const [activity, setActivity] = useState([])
  const [activeStep, setActiveStep] = useState(1)
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [lifecycle, setLifecycle] = useState([])
  const [message, setMessage] = useState('Miden wallet')
  const [notes, setNotes] = useState([])
  const [operation, setOperation] = useState(null)
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [syncHeight, setSyncHeight] = useState(0)
  const [toast, setToast] = useState(null)
  const [walletAssets, setWalletAssets] = useState([])

  useEffect(() => {
    busyRef.current = isBusy
  }, [isBusy])

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      globalThis.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }

    setToast(null)
  }, [])

  const showToast = useCallback(
    (nextToast) => {
      dismissToast()
      setToast(nextToast)
      toastTimerRef.current = globalThis.setTimeout(() => {
        setToast(null)
        toastTimerRef.current = null
      }, 4200)
    },
    [dismissToast],
  )

  const startOperation = useCallback((title, detail) => {
    setOperation({ detail, title })
  }, [])

  const updateOperation = useCallback((detail, title) => {
    setOperation((current) => ({
      detail,
      title: title || current?.title || 'Working',
    }))
  }, [])

  const completeOperation = useCallback(
    (title, detail) => {
      setOperation(null)
      showToast({ detail, kind: 'success', title })
    },
    [showToast],
  )

  const failOperation = useCallback(
    (errorValue, title = 'Action failed') => {
      const detail = formatError(errorValue)
      setOperation(null)
      setError(detail)
      showToast({ detail, kind: 'error', title })
      return detail
    },
    [showToast],
  )

  const applyDashboard = useCallback((dashboard, overlayActivity = []) => {
    const nextAssetId = dashboard.primaryAsset?.faucetId || ''

    selectedFaucetIdRef.current = nextAssetId
    setAccount(dashboard.account)
    setNotes(dashboard.notes)
    setSelectedAsset(dashboard.primaryAsset)
    setSelectedAssetId(nextAssetId)
    setSyncHeight(dashboard.syncHeight)
    setWalletAssets(dashboard.walletAssets)
    setActivity((items) => mergeActivity([...overlayActivity, ...dashboard.activity, ...items]))
  }, [])

  const refreshDashboard = useCallback(
    async (
      adapter = walletAdapterRef.current,
      overlayActivity = [],
      faucetId = selectedFaucetIdRef.current,
    ) => {
      if (!adapter) return null

      const dashboard = await readExtensionDashboard(adapter, faucetId)
      applyDashboard(dashboard, overlayActivity)
      setIsConnected(true)

      return dashboard
    },
    [applyDashboard],
  )

  useEffect(() => {
    if (!isConnected) return undefined

    const intervalId = globalThis.setInterval(async () => {
      if (!walletAdapterRef.current || busyRef.current) return

      try {
        await refreshDashboard()
      } catch {
        // Auto-refresh is intentionally quiet; manual refresh still reports errors.
      }
    }, 20_000)

    return () => globalThis.clearInterval(intervalId)
  }, [isConnected, refreshDashboard])

  const validateDraft = useCallback(
    ({ amount, recipient }) => {
      let parsedAmount = 0n
      let amountOk

      try {
        parsedAmount = parseAmount(amount)
        amountOk = true
      } catch {
        amountOk = false
      }

      const available = parseBalance(selectedAsset?.amount)
      const items = [
        { label: 'Wallet connected', ok: isConnected },
        { label: 'Recipient account format', ok: isLikelyMidenAddress(recipient) },
        { label: 'Faucet asset selected', ok: Boolean(selectedAsset?.faucetId) },
        { label: 'Amount is valid', ok: amountOk },
        { label: 'Balance covers amount', ok: amountOk && parsedAmount <= available },
      ]
      const ready = items.every((item) => item.ok)

      return {
        items,
        ready,
        summary: ready ? 'Ready for wallet approval' : 'Resolve blocked checks',
      }
    },
    [isConnected, selectedAsset],
  )

  const connect = useCallback(async () => {
    setError('')
    setIsBusy(true)
    setMessage('Opening extension')
    setActiveStep(1)
    setLifecycle(buildLifecycle(sendLifecycle, 0))
    startOperation('Connecting wallet', 'Waiting for approval in the Miden browser extension')

    try {
      const adapter = await connectExtensionWallet()
      walletAdapterRef.current = adapter
      updateOperation('Reading extension account, assets, and consumable notes')
      await refreshDashboard(adapter)
      setMessage('Extension connected')
      setLifecycle([])
      completeOperation('Wallet connected', 'MidBid is using your Miden browser extension account.')
    } catch (connectError) {
      failOperation(connectError, 'Connection failed')
      setMessage('Miden wallet error')
    } finally {
      setIsBusy(false)
    }
  }, [completeOperation, failOperation, refreshDashboard, startOperation, updateOperation])

  useEffect(() => {
    if (!isConnected) return undefined

    return onExtensionAccountChange(async (nextAddress) => {
      if (!nextAddress || nextAddress === account.id || busyRef.current) return

      try {
        const adapter = await reconnectExtensionWallet(walletAdapterRef.current)
        walletAdapterRef.current = adapter
        await refreshDashboard(adapter)
        showToast({
          detail: `Now connected to ${shorten(nextAddress)}.`,
          kind: 'success',
          title: 'Wallet switched',
        })
      } catch {
        // Manual refresh/reconnect remains available from the wallet menu.
      }
    })
  }, [account.id, isConnected, refreshDashboard, showToast])

  const disconnect = useCallback(async () => {
    setError('')
    setIsBusy(true)
    setMessage('Disconnecting wallet')
    startOperation('Disconnecting wallet', 'Closing the Miden extension wallet session')

    try {
      await disconnectExtensionWallet(walletAdapterRef.current)
      walletAdapterRef.current = null
      selectedFaucetIdRef.current = ''
      setAccount(disconnectedAccount)
      setActivity([])
      setActiveStep(1)
      setIsConnected(false)
      setLifecycle([])
      setMessage('Miden wallet')
      setNotes([])
      setSelectedAsset(null)
      setSelectedAssetId('')
      setSyncHeight(0)
      setWalletAssets([])
      completeOperation('Wallet disconnected', 'You can connect another Miden wallet account now.')
    } catch (disconnectError) {
      failOperation(disconnectError, 'Disconnect failed')
      setMessage('Miden wallet error')
    } finally {
      setIsBusy(false)
    }
  }, [completeOperation, failOperation, startOperation])

  const switchWallet = useCallback(async () => {
    if (!walletAdapterRef.current) {
      await connect()
      return
    }

    const previousAddress = account.id

    setError('')
    setIsBusy(true)
    setMessage('Switch in extension')
    startOperation(
      'Switch wallet',
      'Choose another account inside the Miden Wallet extension. MidBid is waiting for the active address to change.',
    )

    try {
      const nextAddress = await waitForWalletAddressChange(previousAddress)
      updateOperation(`Detected ${shorten(nextAddress)}. Reconnecting MidBid to that account.`)
      const adapter = await reconnectExtensionWallet(walletAdapterRef.current)
      walletAdapterRef.current = adapter
      await refreshDashboard(adapter)
      setMessage(`Connected ${shorten(nextAddress)}`)
      completeOperation('Wallet switched', `Now connected to ${shorten(nextAddress)}.`)
    } catch (switchError) {
      setOperation(null)
      setMessage('Switch cancelled')
      showToast({
        detail: formatError(switchError),
        kind: 'error',
        title: 'No wallet switch detected',
      })
    } finally {
      setIsBusy(false)
    }
  }, [
    account.id,
    completeOperation,
    connect,
    refreshDashboard,
    showToast,
    startOperation,
    updateOperation,
  ])

  const sync = useCallback(async () => {
    if (!walletAdapterRef.current) {
      await connect()
      return
    }

    setError('')
    setIsBusy(true)
    setMessage('Refreshing wallet')
    startOperation('Refreshing wallet', 'Updating assets and consumable notes from the Miden extension')

    try {
      await refreshDashboard()
      setMessage('Wallet current')
      completeOperation('Refresh complete', 'Extension wallet state is current.')
    } catch (syncError) {
      failOperation(syncError, 'Refresh failed')
      setMessage('Miden wallet error')
    } finally {
      setIsBusy(false)
    }
  }, [completeOperation, connect, failOperation, refreshDashboard, startOperation])

  const selectAsset = useCallback(
    async (faucetId) => {
      selectedFaucetIdRef.current = faucetId
      setSelectedAssetId(faucetId)

      const localAsset = walletAssets.find((asset) => asset.faucetId === faucetId)

      if (localAsset) {
        setSelectedAsset(localAsset)
        setAccount((current) => ({
          ...current,
          asset: localAsset.label,
          balance: localAsset.displayAmount,
        }))
      }

      if (walletAdapterRef.current) {
        await refreshDashboard(walletAdapterRef.current, [], faucetId)
      }
    },
    [refreshDashboard, walletAssets],
  )

  const mint = useCallback(async () => {
    const detail =
      'Use the official Miden testnet faucet to fund this extension wallet, then claim in wallet and refresh MidBid.'

    setError(detail)
    setMessage('Open faucet')
    openFaucetWindow()
    showToast({
      detail,
      kind: 'success',
      title: 'Opening faucet',
    })
  }, [showToast])

  const openFaucet = useCallback(() => {
    openFaucetWindow()
    showToast({
      detail: 'Paste your connected Miden wallet address into the faucet, request MIDEN, claim in wallet, then refresh here.',
      kind: 'success',
      title: 'Faucet opened',
    })
  }, [showToast])

  const createAuctionVault = useCallback(async () => {
    if (!walletAdapterRef.current) {
      const detail = 'Connect the Miden browser extension before creating an auction account.'

      setError(detail)
      setMessage('Connect wallet first')
      showToast({
        detail,
        kind: 'error',
        title: 'Wallet required',
      })
      return null
    }

    setError('')
    setIsBusy(true)
    setMessage('Creating auction account')
    startOperation('Creating auction account', 'Requesting a dedicated Miden account for this private auction')

    try {
      const accountId = await createExtensionAuctionAccount(walletAdapterRef.current)

      updateOperation(`Auction account ${shorten(accountId)} is ready. Refreshing wallet state.`)
      await refreshDashboard(walletAdapterRef.current)
      setMessage(`Auction ${shorten(accountId)}`)
      completeOperation(
        'Auction account ready',
        `Private bid notes will target ${shorten(accountId)}.`,
      )

      return { accountId }
    } catch (createError) {
      failOperation(createError, 'Auction account failed')
      setMessage('Miden wallet error')
      return null
    } finally {
      setIsBusy(false)
    }
  }, [completeOperation, failOperation, refreshDashboard, showToast, startOperation, updateOperation])

  const submitBid = useCallback(
    async ({ amount, noteType, recipient }) => {
      if (!walletAdapterRef.current) {
        const detail = 'Connect the Miden browser extension before bidding.'
        setError(detail)
        setMessage('Connect wallet first')
        showToast({
          detail,
          kind: 'error',
          title: 'Wallet required',
        })
        return { ok: false }
      }

      const preflight = validateDraft({ amount, recipient })

      if (!preflight.ready) {
        const blocked = preflight.items
          .filter((item) => !item.ok)
          .map((item) => item.label.toLowerCase())
          .join(', ')
        const detail = `Preflight blocked: ${blocked}.`

        setError(detail)
        setMessage('Preflight blocked')
        showToast({
          detail,
          kind: 'error',
          title: 'Cannot send yet',
        })
        return { ok: false }
      }

      setError('')
      setIsBusy(true)
      setMessage('Wallet request')
      setActiveStep(1)
      setLifecycle(buildLifecycle(sendLifecycle, 0))
      startOperation('Preflight complete', 'Requesting wallet approval for this sealed bid note')

      try {
        setActiveStep(2)
        setLifecycle(buildLifecycle(sendLifecycle, 1))
        updateOperation('Approve the send request in the Miden extension', 'Wallet approval')
        const txId = await submitExtensionBidNote(walletAdapterRef.current, {
          amount,
          asset: selectedAsset,
          noteType,
          recipient,
        })
        let confirmed = false
        let status = 'submitted'

        setActiveStep(4)
        setLifecycle(buildLifecycle(sendLifecycle, 2))
        updateOperation('Transaction submitted; waiting for wallet confirmation')

        if (txId) {
          try {
            await waitForExtensionTransaction(walletAdapterRef.current, txId)
            confirmed = true
            status = 'confirmed'
            setLifecycle(buildLifecycle(sendLifecycle, 3))
          } catch {
            status = 'submitted'
          }
        }

        const overlay = buildActivity({
          amount: `${amount} ${account.asset}`,
          id: txId || `wallet_${Date.now()}`,
          peer: shorten(recipient),
          status: noteType === 'private' ? `${status} private` : `${status} public`,
          type: 'Bid',
        })

        await refreshDashboard(walletAdapterRef.current, [overlay])
        setMessage(txId ? `Submitted ${shorten(txId)}` : 'Bid submitted')
        completeOperation(
          confirmed ? 'Bid confirmed' : 'Bid submitted',
          txId
            ? `Wallet returned transaction ${shorten(txId)}.`
            : 'The extension accepted the sealed bid request.',
        )
        return { confirmed, ok: true, txId }
      } catch (sendError) {
        setActiveStep(1)
        setLifecycle(markLifecycleFailed(sendLifecycle, 1))
        const detail = failOperation(sendError, 'Bid failed')
        setMessage('Miden wallet error')
        return { error: detail, ok: false }
      } finally {
        setIsBusy(false)
      }
    },
    [
      account.asset,
      completeOperation,
      failOperation,
      refreshDashboard,
      selectedAsset,
      showToast,
      startOperation,
      updateOperation,
      validateDraft,
    ],
  )

  const consumeNote = useCallback(
    async (noteId) => {
      if (!walletAdapterRef.current) return { ok: false }

      const note = notes.find((item) => item.id === noteId)

      if (!note) return { ok: false }

      setError('')
      setIsBusy(true)
      setMessage('Wallet consume')
      setActiveStep(5)
      setLifecycle(buildLifecycle(consumeLifecycle, 0))
      startOperation('Consuming note', 'Requesting wallet approval to claim this consumable note')

      try {
        setLifecycle(buildLifecycle(consumeLifecycle, 1))
        updateOperation('Approve the consume request in the Miden extension', 'Wallet approval')
        const txId = await consumeExtensionNote(walletAdapterRef.current, note)
        let confirmed = false
        let status = 'submitted'

        setLifecycle(buildLifecycle(consumeLifecycle, 2))
        updateOperation('Consume transaction submitted; waiting for confirmation')

        if (txId) {
          try {
            await waitForExtensionTransaction(walletAdapterRef.current, txId)
            confirmed = true
            status = 'confirmed'
            setLifecycle(buildLifecycle(consumeLifecycle, 3))
          } catch {
            status = 'submitted'
          }
        }

        const overlay = buildActivity({
          amount: `${note.amount} ${note.asset}`,
          id: txId || `consume_${Date.now()}`,
          peer: note.from,
          status,
          type: 'Consumed',
        })

        await refreshDashboard(walletAdapterRef.current, [overlay])
        setMessage(txId ? `Consume ${shorten(txId)}` : 'Consume submitted')
        completeOperation(
          confirmed ? 'Note confirmed' : 'Note claim submitted',
          'The extension accepted the consume request.',
        )
        return { confirmed, note, ok: true, txId }
      } catch (consumeError) {
        setLifecycle(markLifecycleFailed(consumeLifecycle, 1))
        const detail = failOperation(consumeError, 'Consume failed')
        setMessage('Miden wallet error')
        return { error: detail, ok: false }
      } finally {
        setIsBusy(false)
      }
    },
    [completeOperation, failOperation, notes, refreshDashboard, startOperation, updateOperation],
  )

  return {
    account,
    activity,
    activeStep,
    assetOptions:
      walletAssets.length > 0
        ? walletAssets.map((asset) => ({ label: asset.optionLabel, value: asset.faucetId }))
        : [{ label: `${account.asset} / 0`, value: account.asset }],
    connect,
    consumeNote,
    createAuctionVault,
    disconnect,
    dismissToast,
    error,
    isBusy,
    isConnected,
    lifecycle,
    message,
    mint,
    notes,
    openFaucet,
    operation,
    selectedAsset,
    selectedAssetId,
    selectAsset,
    submitBid,
    switchWallet,
    sync,
    syncHeight,
    toast,
    validateDraft,
  }
}

function openFaucetWindow() {
  globalThis.window?.open?.(faucetUrl, '_blank', 'noopener,noreferrer')
}

function buildActivity({ amount, id, peer, status, type }) {
  return {
    amount,
    id,
    peer,
    status,
    time: getDisplayTime(),
    type,
  }
}

function buildLifecycle(labels, activeIndex) {
  return labels.map((label, index) => ({
    label,
    state: index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'pending',
  }))
}

function markLifecycleFailed(labels, failedIndex) {
  return labels.map((label, index) => ({
    label,
    state: index < failedIndex ? 'complete' : index === failedIndex ? 'failed' : 'pending',
  }))
}

function mergeActivity(items) {
  const seen = new Set()

  return items
    .filter((item) => {
      const key = item.id || `${item.type}-${item.time}-${item.peer}`

      if (seen.has(key)) return false

      seen.add(key)
      return true
    })
    .slice(0, 10)
}

function parseAmount(value) {
  const normalized = String(value || '').trim().replaceAll(',', '')

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error('Enter a MIDEN amount with up to 6 decimals.')
  }

  const amount = toBaseUnits(normalized)

  if (amount <= 0n) {
    throw new Error('Amount must be greater than zero.')
  }

  return amount
}

function parseBalance(value) {
  const normalized = String(value || '0').trim().replaceAll(',', '')

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) return 0n

  return toBaseUnits(normalized)
}

function toBaseUnits(value) {
  const [whole, fraction = ''] = String(value).split('.')
  const paddedFraction = fraction.padEnd(6, '0').slice(0, 6)

  return BigInt(whole || '0') * 1_000_000n + BigInt(paddedFraction || '0')
}

function isLikelyMidenAddress(value) {
  const address = String(value || '').trim()

  if (address.length < 12 || /\s/.test(address)) return false
  if (/^0x[0-9a-f]+$/i.test(address)) return address.length >= 16

  return /^m[a-z0-9_]{10,}$/i.test(address)
}

function formatError(error) {
  if (error instanceof Error && error.message) return error.message
  return String(error || 'Miden wallet request failed.')
}

function waitForWalletAddressChange(previousAddress, timeout = 45_000) {
  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (nextAddress) => {
      if (settled) return
      if (!nextAddress || nextAddress === previousAddress) return

      settled = true
      cleanup()
      resolve(nextAddress)
    }

    const unsubscribe = onExtensionAccountChange(finish)
    const intervalId = globalThis.setInterval(() => finish(getActiveWalletAddress()), 800)
    const timeoutId = globalThis.setTimeout(() => {
      if (settled) return

      settled = true
      cleanup()
      reject(new Error('Switch accounts in the Miden Wallet extension, then try this action again.'))
    }, timeout)

    function cleanup() {
      unsubscribe()
      globalThis.clearInterval(intervalId)
      globalThis.clearTimeout(timeoutId)
    }
  })
}

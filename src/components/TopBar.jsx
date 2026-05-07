import { useEffect, useRef, useState } from 'react'
import { IconRefresh, StatusDot } from './icons'
import { shorten } from '../lib/formatUtils'

export function TopBar({
  accountId,
  isBusy,
  isConnected,
  statusDetail,
  statusText,
  theme,
  onConnect,
  onCopyAddress,
  onDisconnect,
  onFund,
  onSync,
  onSwitchWallet,
  onToggleTheme,
}) {
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const walletMenuRef = useRef(null)

  useEffect(() => {
    function closeMenu(event) {
      if (!walletMenuRef.current?.contains(event.target)) {
        setWalletMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeMenu)

    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [])

  return (
    <div className="topbar">
      <div className="network-readout" title={statusDetail}>
        <StatusDot />
        <span>{statusText}</span>
      </div>
      <div className="topbar-actions">
        <div className="wallet-menu" ref={walletMenuRef}>
          <button
            className="topbar-action wallet-button"
            type="button"
            disabled={isBusy}
            aria-expanded={walletMenuOpen}
            onClick={() => {
              if (!isConnected) {
                onConnect()
                return
              }

              setWalletMenuOpen((isOpen) => !isOpen)
            }}
          >
            {isConnected && accountId ? shorten(accountId) : 'Connect'}
          </button>

          {walletMenuOpen && isConnected && (
            <div className="wallet-dropdown">
              <button
                type="button"
                onClick={() => {
                  onCopyAddress()
                  setWalletMenuOpen(false)
                }}
              >
                Copy address
              </button>
              <button
                type="button"
                onClick={() => {
                  onSync()
                  setWalletMenuOpen(false)
                }}
              >
                Refresh assets
              </button>
              <button
                type="button"
                onClick={() => {
                  onSwitchWallet()
                  setWalletMenuOpen(false)
                }}
              >
                Switch wallet
              </button>
              <button
                type="button"
                onClick={() => {
                  onDisconnect()
                  setWalletMenuOpen(false)
                }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
        <button
          className="topbar-action icon-only"
          type="button"
          disabled={isBusy || !isConnected}
          title="Refresh wallet"
          aria-label="Refresh wallet"
          onClick={onSync}
        >
          <IconRefresh />
        </button>
        <button className="topbar-action" type="button" disabled={!isConnected} onClick={onFund}>
          Faucet
        </button>
        <button className="theme-toggle" type="button" onClick={onToggleTheme}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </div>
  )
}

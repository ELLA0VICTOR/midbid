import { AppMark } from './icons'
import { DataLine } from './ui'

export function HeroPanel({ account }) {
  return (
    <header className="hero-panel">
      <div className="brand-block">
        <AppMark />
        <div>
          <p className="eyebrow">Private sealed-bid auctions</p>
          <h1>MIDBID</h1>
        </div>
      </div>

      <div className="account-strip">
        <DataLine className="account-address" label="Account" title={account.id} value={account.id} />
        <DataLine label="Alias" value={account.alias} />
        <DataLine label="Vault" value={`${account.balance} ${account.asset}`} />
        <DataLine label="Mode" value={account.mode || 'Sealed notes'} />
      </div>
    </header>
  )
}

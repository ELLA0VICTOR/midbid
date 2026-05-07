import { useRef, useState } from 'react'
import { IconCalendar } from './icons'
import { getDefaultAuctionEnd, getLocalTimezone, shorten } from '../lib/formatUtils'

const maxImageBytes = 2_000_000

export function AuctionCreateModal({
  connectedAccount,
  isBusy,
  isConnected,
  onClose,
  onCreate,
}) {
  const fileInputRef = useRef(null)
  const [form, setForm] = useState(() => createDefaultForm(connectedAccount))
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()

    const validationError = validateForm(form, isConnected)

    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    const created = await onCreate({
      ...form,
      deadline: form.endsAt,
      timezone: getLocalTimezone(),
    })

    if (created) onClose()
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Upload an image file for the auction item.')
      return
    }

    if (file.size > maxImageBytes) {
      setError('Use an image under 2 MB so the auction can be saved locally.')
      return
    }

    const image = await readFileAsDataUrl(file)

    setError('')
    setForm((current) => ({
      ...current,
      image,
      imageName: file.name,
    }))
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="auction-create-title"
        aria-modal="true"
        className="auction-create-modal"
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <p className="panel-kicker">Private auction</p>
            <h2 id="auction-create-title">Create auction</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="auction-create-form" onSubmit={handleSubmit}>
          <button
            className={`image-upload ${form.image ? 'has-image' : ''}`}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            {form.image ? (
              <img alt="" src={form.image} />
            ) : (
              <span>Upload item image</span>
            )}
          </button>
          <input
            ref={fileInputRef}
            accept="image/*"
            className="hidden-file-input"
            type="file"
            onChange={handleImageChange}
          />

          <div className="modal-fields">
            <label className="field">
              <span>Item title</span>
              <input
                autoFocus
                value={form.title}
                placeholder="Rare hardware wallet"
                onChange={(event) => updateField(setForm, 'title', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Reserve bid</span>
              <input
                inputMode="decimal"
                value={form.reserve}
                placeholder="250"
                onChange={(event) => updateField(setForm, 'reserve', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Deadline</span>
              <div className="datetime-field">
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => updateField(setForm, 'endsAt', event.target.value)}
                />
                <IconCalendar />
              </div>
            </label>

            <label className="field">
              <span>Settlement account</span>
              <input
                value={form.settlementAccount}
                placeholder={isConnected ? `Dedicated account or ${shorten(connectedAccount)}` : 'mtst...'}
                onChange={(event) => updateField(setForm, 'settlementAccount', event.target.value)}
              />
            </label>

            <label className="field modal-brief-field">
              <span>Description</span>
              <textarea
                value={form.brief}
                placeholder="Condition, provenance, delivery notes, or anything bidders should know."
                rows={4}
                onChange={(event) => updateField(setForm, 'brief', event.target.value)}
              ></textarea>
            </label>
          </div>

          <div className="modal-footer">
            <p>
              {isConnected
                ? 'MidBid will route private bid notes to the connected settlement account.'
                : 'Connect wallet or paste a settlement account before creating.'}
            </p>
            {error && <strong>{error}</strong>}
            <button className="primary-action" type="submit" disabled={isBusy}>
              {isBusy ? 'Creating' : 'Create private auction'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function createDefaultForm(connectedAccount) {
  return {
    brief: '',
    endsAt: getDefaultAuctionEnd(),
    image: '',
    imageName: '',
    reserve: '',
    settlementAccount: connectedAccount || '',
    title: '',
  }
}

function updateField(setForm, field, value) {
  setForm((current) => ({
    ...current,
    [field]: value,
  }))
}

function validateForm(form, isConnected) {
  if (!form.title.trim()) return 'Add an item title.'
  if (!/^\d+(\.\d{1,6})?$/.test(form.reserve.trim()) || Number(form.reserve) <= 0) {
    return 'Enter a valid reserve bid.'
  }
  if (!form.endsAt || Number.isNaN(new Date(form.endsAt).getTime())) return 'Choose a deadline.'
  if (new Date(form.endsAt).getTime() <= Date.now()) return 'Choose a future deadline.'
  if (!isConnected && !form.settlementAccount.trim()) {
    return 'Connect wallet or paste a settlement account.'
  }

  return ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => resolve(String(reader.result || '')))
    reader.addEventListener('error', () => reject(new Error('Could not read image file.')))
    reader.readAsDataURL(file)
  })
}

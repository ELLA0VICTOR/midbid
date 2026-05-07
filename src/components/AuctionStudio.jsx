export function AuctionStudio({ onOpenCreate }) {
  return (
    <section className="panel auction-studio" aria-labelledby="auction-studio-title">
      <div className="panel-heading studio-heading">
        <div>
          <p className="panel-kicker">Auction room</p>
          <h2 id="auction-studio-title">Create a private auction</h2>
        </div>
        <button className="primary-action studio-create" type="button" onClick={onOpenCreate}>
          Create auction
        </button>
      </div>

      <div className="studio-empty">
        <p>Upload the item, set the reserve and close time, then MidBid publishes the auction card below.</p>
      </div>
    </section>
  )
}

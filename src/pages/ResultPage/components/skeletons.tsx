export function BaziFortuneLoadingCard() {
  return (
    <section className="fortune-selector-card fortune-selector-card-loading">
      <div className="fortune-skeleton-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="fortune-skeleton-row" key={`row-${index}`}>
            <span className="skeleton-block fortune-skeleton-label" />
            <div className="fortune-skeleton-list">
              {Array.from({ length: 6 }, (_, itemIndex) => (
                <span
                  className="skeleton-block fortune-skeleton-item"
                  key={`item-${index}-${itemIndex}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BaziFortuneLoadingModal() {
  return (
    <div className="workspace-ui-dialog-backdrop">
      <div className="workspace-ui-dialog bazi-fortune-modal">
        <div className="fortune-modal-skeleton" aria-hidden="true">
          <span className="skeleton-block fortune-modal-skeleton-title" />
          <span className="skeleton-block fortune-modal-skeleton-tip" />
          <span className="skeleton-block fortune-modal-skeleton-tip fortune-modal-skeleton-tip-short" />
          <div className="fortune-modal-skeleton-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="fortune-modal-skeleton-section" key={`section-${index}`}>
                <span className="skeleton-block fortune-modal-skeleton-heading" />
                <div className="fortune-modal-skeleton-list">
                  {Array.from({ length: 4 }, (_, itemIndex) => (
                    <span
                      className="skeleton-block fortune-modal-skeleton-item"
                      key={`item-${index}-${itemIndex}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InlineSkeleton(props: { className?: string }) {
  return <span className={`skeleton-block ${props.className ?? ''}`.trim()} aria-hidden="true" />;
}

export function PromptPreSkeleton() {
  return (
    <div className="result-pre result-pre-skeleton" aria-hidden="true">
      <span className="skeleton-block result-pre-skeleton-line" />
      <span className="skeleton-block result-pre-skeleton-line result-pre-skeleton-line-long" />
      <span className="skeleton-block result-pre-skeleton-line" />
      <span className="skeleton-block result-pre-skeleton-line result-pre-skeleton-line-short" />
      <span className="skeleton-block result-pre-skeleton-line result-pre-skeleton-line-long" />
      <span className="skeleton-block result-pre-skeleton-line" />
    </div>
  );
}

export function ZiweiBoardSkeleton(props: { title: string; name: string }) {
  return (
    <section className="result-showcase-card ziwei-showcase-card ziwei-board-skeleton">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{props.title}</p>
          <h2>{props.name}</h2>
        </div>
        <div className="result-chip-row" aria-hidden="true">
          <span className="skeleton-block ziwei-board-skeleton-chip" />
          <span className="skeleton-block ziwei-board-skeleton-chip" />
          <span className="skeleton-block ziwei-board-skeleton-chip ziwei-board-skeleton-chip-short" />
        </div>
      </div>

      <div className="result-summary-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="result-stat-card" key={`stat-${index}`}>
            <span className="skeleton-block ziwei-board-skeleton-line ziwei-board-skeleton-line-short" />
            <span className="skeleton-block ziwei-board-skeleton-line" />
            <span className="skeleton-block ziwei-board-skeleton-line ziwei-board-skeleton-line-short" />
          </div>
        ))}
      </div>

      <div className="ziwei-layout" aria-hidden="true">
        <div className="ziwei-board-skeleton-panel ziwei-board-skeleton-main" />
        <div className="ziwei-side-panel">
          <div className="ziwei-board-skeleton-panel ziwei-board-skeleton-side" />
          <div className="ziwei-board-skeleton-panel ziwei-board-skeleton-side" />
        </div>
      </div>
    </section>
  );
}

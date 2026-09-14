export default function LoadingScreen({ label, onRetry } = {}) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[var(--color-surface-cinematic)] text-[var(--color-text-inverse)]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 text-sm tracking-[0.18em] uppercase opacity-90">
          <span className="size-2 animate-pulse rounded-full bg-[var(--color-brand-primary)]" />
          {label || 'Verifying access'}
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-full border border-white/25 px-4 text-xs font-semibold tracking-[0.14em] uppercase text-white/90"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  )
}

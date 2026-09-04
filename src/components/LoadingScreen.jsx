export default function LoadingScreen({ label } = {}) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[var(--color-surface-cinematic)] text-[var(--color-text-inverse)]">
      <div className="flex items-center gap-3 text-sm tracking-[0.18em] uppercase opacity-90">
        <span className="size-2 animate-pulse rounded-full bg-[var(--color-brand-primary)]" />
        {label || 'Verifying access'}
      </div>
    </div>
  )
}

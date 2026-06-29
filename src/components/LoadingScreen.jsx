export default function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#090d12] text-slate-200">
      <div className="flex items-center gap-3 text-sm tracking-[0.18em] uppercase">
        <span className="size-2 animate-pulse rounded-full bg-lime-400 shadow-[0_0_18px_#a3e635]" />
        Verifying access
      </div>
    </div>
  )
}

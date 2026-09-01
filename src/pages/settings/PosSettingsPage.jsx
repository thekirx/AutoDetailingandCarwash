import PosSettingsPanel from '@/pages/pos/PosSettingsPanel'

/** Settings → POS: payment methods, expense kinds, shift-close field editor. */
export default function PosSettingsPage() {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-8">
      <PosSettingsPanel embedded={false} />
    </section>
  )
}

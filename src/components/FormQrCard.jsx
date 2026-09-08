import { useEffect, useState } from 'react'
import { Download, Expand, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formQrDataUrl } from '@/lib/opsForms'
import { toast } from 'sonner'

/**
 * Permanent QR for a stable /f/:slug link — generated client-side (no third-party host).
 * Preview + PNG download for print / desk stickers.
 */
export default function FormQrCard({
  url,
  title = 'Form',
  size = 180,
  className = '',
}) {
  const [dataUrl, setDataUrl] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!url) {
      setDataUrl('')
      return undefined
    }
    setBusy(true)
    formQrDataUrl(url, size)
      .then((next) => {
        if (!cancelled) setDataUrl(next)
      })
      .catch(() => {
        if (!cancelled) setDataUrl('')
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [url, size])

  async function downloadPng() {
    if (!url) return
    try {
      const big = await formQrDataUrl(url, 512)
      const a = document.createElement('a')
      a.href = big
      a.download = `${String(title || 'hakum-form')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'hakum-form'}-qr.png`
      a.click()
      toast.success('QR downloaded')
    } catch (err) {
      toast.error(err?.message || 'Could not download QR')
    }
  }

  if (!url) return null

  return (
    <div className={`flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 ${className}`}>
      <QrCode className="size-4 text-muted-foreground" aria-hidden />
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`QR code for ${title}`}
          width={size}
          height={size}
          className="rounded-lg bg-white p-2"
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground"
          style={{ width: size, height: size }}
        >
          {busy ? 'Building QR…' : 'QR unavailable'}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">Permanent link QR</p>
      <div className="flex flex-wrap justify-center gap-1">
        <Button type="button" size="sm" variant="outline" className="cursor-pointer" disabled={!dataUrl} onClick={() => setPreviewOpen(true)}>
          <Expand className="size-3.5" /> Preview
        </Button>
        <Button type="button" size="sm" variant="outline" className="cursor-pointer" disabled={!url} onClick={downloadPng}>
          <Download className="size-3.5" /> Download
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR · {title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {dataUrl ? (
              <img src={dataUrl} alt="" width={280} height={280} className="rounded-xl bg-white p-3" />
            ) : null}
            <p className="break-all text-center font-mono text-xs text-muted-foreground">{url}</p>
            <Button type="button" className="cursor-pointer" onClick={downloadPng}>
              <Download className="size-4" /> Download PNG
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

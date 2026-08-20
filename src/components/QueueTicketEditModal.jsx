import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import QueueTicketEditor from './QueueTicketEditor'

/** Board card → edit ticket without leaving the queue lanes. */
export default function QueueTicketEditModal({ bookingId, open, onOpenChange, onUpdated }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="queue-ticket-dialog flex max-h-[min(92dvh,920px)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Edit queue ticket</DialogTitle>
          <DialogDescription>Update status, price, and staff for this car.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {open && bookingId ? (
            <QueueTicketEditor
              bookingId={bookingId}
              variant="modal"
              onUpdated={onUpdated}
              onClose={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

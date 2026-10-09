import { isBookingBoardService } from '@/lib/serviceKinds'
import { buildVisitProgress } from '@/queue/queueLogic'

/** Progress for one portal visit: the server's steps when it sent them, otherwise built from the status. */
export function visitProgressFor(visit) {
  const detailing = visit.kind === 'detailing' || isBookingBoardService(visit.services || visit)
  const kind = detailing ? 'detailing' : 'service'
  return visit.visit?.steps?.length ? { ...visit.visit, kind: visit.visit.kind || kind } : buildVisitProgress(visit.status, kind)
}

/** Where the car is on its steps: index, total, and the names of this step and the next. */
export function visitStepInfo(progress) {
  const steps = progress?.steps || []
  const last = Math.max(steps.length - 1, 0)
  const raw = Number(progress?.currentIndex)
  const index = progress?.isComplete ? last : Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 0), last)
  const name = (step) => step?.label || step?.key || ''
  return {
    steps,
    index,
    total: steps.length,
    done: Boolean(progress?.isComplete),
    current: progress?.isComplete ? 'Completed' : name(steps[index]),
    next: progress?.isComplete ? '' : name(steps[index + 1]),
  }
}

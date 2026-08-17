/** Calendar item hrefs — click goes to the owning Planner / bookings surface. */

export function hrefForCalendarItem(resource) {
  const type = resource?.type
  if (type === 'planning' && resource.card?.id) {
    return `/operations/planning?tab=board&card=${resource.card.id}`
  }
  if (type === 'event' && resource.event?.id) {
    return `/operations/planning?tab=events&event=${resource.event.id}`
  }
  if (type === 'booking' && resource.booking?.id) {
    return `/operations/bookings?id=${resource.booking.id}`
  }
  if (type === 'form' && resource.submission?.form_id) {
    return `/operations/planning?tab=forms&results=${resource.submission.form_id}`
  }
  return '/operations/planning?tab=calendar'
}

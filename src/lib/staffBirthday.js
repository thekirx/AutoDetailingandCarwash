import { isBirthdayToday, parseDateOnly } from './birthdayPerk.js'
import { getLocalCalendarDate } from './localCalendarDate.js'

/** Manila month 1–12 for “birthdays this month” board. */
export function birthdaysInMonth(people = [], { month = null, todayKey = getLocalCalendarDate() } = {}) {
  const targetMonth = month ?? Number(String(todayKey).slice(5, 7))
  return (people || [])
    .filter((row) => {
      const dob = parseDateOnly(row?.date_of_birth)
      return dob && dob.month === targetMonth
    })
    .sort((a, b) => {
      const da = parseDateOnly(a.date_of_birth)
      const db = parseDateOnly(b.date_of_birth)
      return (da?.day || 0) - (db?.day || 0) || String(a.full_name || '').localeCompare(String(b.full_name || ''))
    })
}

export function staffBirthdaysToday(people = [], now = new Date()) {
  return (people || []).filter((row) => isBirthdayToday(row?.date_of_birth, now))
}

export function formatStaffBirthdayMd(dateOfBirth) {
  const dob = parseDateOnly(dateOfBirth)
  if (!dob) return ''
  return `${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`
}

export function staffNeedsBirthday(profile) {
  return Boolean(profile?.id) && !parseDateOnly(profile?.date_of_birth)
}

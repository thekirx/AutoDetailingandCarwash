/** Attendance CSV export helpers */

export function attendanceRowsToCsv(rows = []) {
  const header = ['Name', 'Username', 'Role', 'Date', 'Status', 'Check in', 'Check out', 'Source']
  const escape = (v) => {
    const s = String(v ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.username ? `@${row.username}` : '',
        row.role || '',
        row.date,
        row.status || '',
        row.checked_in_at || '',
        row.checked_out_at || '',
        row.source || '',
      ]
        .map(escape)
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

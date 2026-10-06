# Attendance

**Route:** `/operations/attendance`  
**Shell:** Floor (crew/TL) / Command

## Purpose
Clock in/out, register, exceptions, heatmap.

## Layout
```
[Clock hero for self]  ← blocked time-in shows an inline error here
[Location alerts]      ← SA / ASA / Branch Admin only, when any exist
[Stat strip]
[Register DataTable / Heatmap]
```

## Components
StatCard, AttendanceHeatmap, DataTable, StatusBadge (late/absent).

## Geofenced time-in and spoof blocking
- **Time in** calls the `geo_clock_in` RPC. The server decides present/late (Asia/Manila vs shift start + 5 min) and writes the row; the `staff_attendance_geofence` trigger rejects any `source='geo'` row that did not come through that RPC, so a direct PostgREST upsert cannot skip the checks.
- Blocked as faked/tampered location (only when the person's geofence is on):
  - `automation`: `navigator.webdriver` (Puppeteer/Selenium-driven browser)
  - `stale_fix`: position timestamp > 5 min old or > 1 min in the future
  - `no_accuracy`: fix has no positive accuracy radius
  - `low_precision`: both coordinates have ≤ 5 decimals (typed or pasted)
  - `pin_match`: coordinates equal the branch map pin (within ~0.1 m)
  - `replayed_fix`: bit-identical coordinates to one of the person's earlier-day check-ins
- On a block: a row goes into `attendance_location_alerts`, an inbox row goes to every active SA, ASA and the branch's Branch Admin(s), and the client asks `/api/notify-ops-event` (`attendance_location_alert`) to send web push. The push is claimed once per alert (`pushed_at`) and only by the blocked person within 10 minutes.
- **Limit (honest):** a web app cannot read Android Developer options or the OS mock-location flag. A careful spoofer who sends realistic, jittered coordinates with an accuracy value is not caught. Only a native app (`Location.isMock()`) can close that gap.

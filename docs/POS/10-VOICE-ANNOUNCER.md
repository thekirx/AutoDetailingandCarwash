# POS voice announcer ("ready for payment")

**Last verified:** 2026-10-13, localhost and production, real Chrome and Edge.

When the floor sends a car to payment, the counter device plays a chime and says, in English:

> "Toyota Vios, plate N B C, 4 8 2 1, is ready for payment."

| Booking has | It says |
|---|---|
| Make, model and plate | "Toyota Vios, plate N B C, 4 8 2 1, is ready for payment." |
| Plate only | "Plate X Y Z, 9, is ready for payment." |
| Make and model only | "Honda City is ready for payment." |
| Nothing | "A car is ready for payment." |
| Voice switched on | "Payment announcements are on." |

The plate is spelled one letter and digit at a time, with a pause between the letters and the numbers. Symbols are removed and names are cut to 40 characters, so it never reads junk. The AI voice and the browser voice say the exact same words (`buildPaymentAnnouncement`).

## Setting up a branch counter

1. Use a **Windows PC or laptop with Microsoft Edge**, connected to the counter speaker and online.
2. Open **POS** and tap **Voice on** once. The device remembers it; other devices stay silent.
3. Edge uses **Microsoft Rosa (Natural), English (Philippines)**, a female Filipino voice speaking English.

| Browser | Voice used | Notes |
|---|---|---|
| Microsoft Edge (recommended) | Rosa, English (Philippines), female | Free, built in, needs internet |
| Google Chrome | Google US English, female | No Philippine voice in Chrome |
| Chrome with no Google voices | Microsoft Zira, female | Windows built-in |
| Other devices | Best available: Philippine, then female English | Depends on installed voices |

The system never picks Microsoft David (male) when a female English voice exists.

## Cost

Free. The browser voice runs in Edge or Chrome at no charge, with no per-car fee and no monthly bill. Example: 3 branches × 50 cars a day = 4,500 announcements a month = ₱0.

Production has no `GEMINI_API_KEY`, so `/api/pos-announce` answers **501** and the device uses the browser voice. That 501 in the browser console is expected, not an error. Do not add the key unless Hakum chooses the Gemini voice: it replaces Rosa, is not Filipino-accented, and costs about ₱0.05 per car (₱0.10 from 2027) once past Google's free tier.

## How it works

| Step | Code |
|---|---|
| Realtime INSERT on `pos_handoffs` reaches the counter | `src/pages/PosPage.jsx` |
| Chime, then the AI clip if it answers within 2.5 s, else the browser voice | `src/lib/posAnnouncer.js` |
| Sentence and voice choice | `src/lib/paymentAnnouncement.js` (`buildPaymentAnnouncement`, `pickAnnouncerVoice`, `waitForVoices`) |
| Optional AI voice (staff-only, branch-scoped) | `server/posAnnounceApi.mjs` |

Browsers report an empty voice list right after page load and fill it in later; Edge's online voices arrive a moment after. Speaking before that falls back to the Windows default (David). The POS loads voices as soon as the page opens and waits up to 2 s for a Philippine voice before the first line.

## Checks

```bash
node --test tests/paymentAnnouncement.test.js
EDGE=1 BASE_URL=http://localhost:5173 node --env-file=.env scripts/_pos-voice-check.mjs
CHROME=1 BASE_URL=http://localhost:5173 node --env-file=.env scripts/_pos-voice-check.mjs
```

The browser check is non-destructive: the waiting ticket is simulated and any sale post is blocked. In Edge and Chrome mode it checks every spoken line uses the female voice, then really speaks the sentence with it.

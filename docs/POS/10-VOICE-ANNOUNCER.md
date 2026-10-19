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

**Browser fallback (default without AI keys):** free. Edge/Chrome, no per-car fee.

**ElevenLabs (preferred when `ELEVENLABS_API_KEY` is set):** same English voiceline, soft high female “station / keigo commercial” delivery (Lily by default). Billed on your ElevenLabs plan. Server-only key — never `VITE_*`.

**Gemini fallback:** if ElevenLabs has a temporary outage (or only `GEMINI_API_KEY` is set), the same English line is synthesized with Aoede.

**Free voice when ElevenLabs credit is gone:** a 402, or a quota/credit error, stops further ElevenLabs calls for that server process. The counter then uses the free browser voice (Rosa on Edge). Gemini is not called for a finished credit balance. A clip already saved for that exact sentence is still played from cache, so a repeat plate does not spend tokens.

**Clip cache (token saver):** clips are keyed by the spoken sentence + voice settings (not `handoff_id`). First play synthesizes once; repeats for the same plate/line hit memory, then private Storage bucket `pos-announce-clips`. Returning customers do not burn TTS tokens again.

Without either key, `/api/pos-announce` answers **501** and the device uses Rosa / browser voice. That 501 is expected.

## How it works

| Step | Code |
|---|---|
| Realtime INSERT on `pos_handoffs` reaches the counter | `src/pages/PosPage.jsx` |
| Chime, then the AI clip if it answers within 4.5 s, else the browser voice | `src/lib/posAnnouncer.js` |
| Sentence and voice choice | `src/lib/paymentAnnouncement.js` (`buildPaymentAnnouncement`, `pickAnnouncerVoice`, `waitForVoices`) |
| Optional AI voice (staff-only, branch-scoped) | `server/posAnnounceApi.mjs` |

Browsers report an empty voice list right after page load and fill it in later; Edge's online voices arrive a moment after. Speaking before that falls back to the Windows default (David). The POS loads voices as soon as the page opens and waits up to 2 s for a Philippine voice before the first line.

## Checks

```bash
node --test tests/paymentAnnouncement.test.js
node --env-file=.env scripts/_pos-voice-ai-compare.mjs
EDGE=1 BASE_URL=http://localhost:5173 node --env-file=.env scripts/_pos-voice-check.mjs
CHROME=1 BASE_URL=http://localhost:5173 node --env-file=.env scripts/_pos-voice-check.mjs
```

`_pos-voice-ai-compare.mjs` writes ElevenLabs + Gemini clips (same English line, station-style woman) into `e2e-evidence/pos-voice/` plus `compare-station.html`. Needs `ELEVENLABS_API_KEY` and `GEMINI_API_KEY` (default Gemini voice **Aoede**, female). The browser check is non-destructive.

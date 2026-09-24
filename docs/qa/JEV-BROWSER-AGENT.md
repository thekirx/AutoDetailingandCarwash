# Jev Ultrafast (browser agent) — Hakum use

Installed outside this repo at `%USERPROFILE%\tools\jev-ultrafast` (not a product dependency).

## Verdict (principal)

**Useful as an exploratory / ad-hoc UI agent. Not a replacement for Hakum’s money-path Puppeteer suite.**

| Dimension | Assessment |
|-----------|------------|
| **Value** | Fast natural-language probes of live UI (login walls, nav, broken buttons, role entry points) without writing a new Puppeteer script every time. |
| **Cost** | TypeSafe + OpenRouter keys; Chrome remote-debugging; nondeterministic paths; paid API per step. |
| **Impact** | Low on product code if kept out-of-repo. High risk if used to mutate POS/payroll on production. |

**Use when:** smoke-exploring a local Vite build, reproducing a “can’t find the button” UX bug, demoing a role path to a human.

**Do not use when:** CI gates, FLOPS evidence, finance/payroll assertions, RBAC deny proofs — keep `e2e:lifecycle-flops`, `e2e:money-path`, `e2e:ui-p0`, `node:test`.

## Setup (this machine)

```powershell
cd $env:USERPROFILE\tools\jev-ultrafast
uv sync
# .env already scaffolded — fill:
#   TYPESAFE_API_KEY=...
#   TEXT_MODEL_API_KEY=...   # OpenRouter in example
uv run browser-harness --doctor
# Allow Chrome “remote debugging” when prompted
uv run jev
# Open http://127.0.0.1:8766
```

Hakum exploratory example:

```powershell
cd $env:USERPROFILE\tools\jev-ultrafast
$env:HAKUM_BASE_URL = "http://127.0.0.1:5173/"
uv run --env-file .env python examples/hakum-shop-day.py
```

## Principal workflow slot

```text
graphify  →  code truth
archify   →  validated diagrams
Puppeteer →  deterministic money / FLOPS evidence
Jev       →  optional exploratory browser agent (human-supervised)
```

Keys stay in `tools\jev-ultrafast\.env` (gitignored there). Never commit them into Hakum.

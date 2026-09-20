# IVLA — Interactive Visual Learning Assistant

Phase 1: Whiteboard Foundation. Phase 2: AI backend (NVIDIA) + result card.
Circle the board -> Generate text (interpret -> explain) or Generate image
(interpret -> image prompt -> FLUX, Pollinations fallback). Typing works too.

## Structure

```
ivla/
  client/   Vite + React (plain JS), HTML5 Canvas, Pointer Events
    src/
      components/  Toolbar.jsx, WhiteboardCanvas.jsx, CapturePreview.jsx
      board/       elements.js, renderer.js, history.js, lasso.js, hitTest.js
      App.jsx, main.jsx, App.css
  server/   Express health-check (GET /api/health -> { ok: true })
```

Board state is a list of typed elements (`stroke`, `shape`, `text`, `image`);
`renderer.js` dispatches on `element.type` via `drawElement(ctx, element)`.

## Run

```bash
npm run install:all   # install root + client + server deps
npm run dev           # starts server :3001 + client :5173 (concurrently)
```

- Client: http://localhost:5173 (Vite proxies `/api` → :3001)
- Server health: http://localhost:3001/api/health

## Setup (AI key)

1. Open `server/.env` in a text editor.
2. Paste your key after `NVIDIA_API_KEY=` with no quotes or spaces:
   `NVIDIA_API_KEY=nvapi-...`
3. Restart the server (`npm run dev` from `ivla/`).
4. Look for `AI key: configured` in the terminal. If it says `AI key: missing`,
   the whiteboard still works; AI buttons show an honest error with Type-it-instead.

Security note: never commit `.env` (it is git-ignored), never paste the key
into chat, issues, screenshots or the client code. The server prints only
`configured`/`missing`, never the key; error responses never include it.

## Phase 2 architecture

```
server/
  config/models.js        # ALL model names + endpoint URLs (edit here)
  prompts/                # interpret.js, explain.js, imagePrompt.js ({ gradeLevel })
  providers/              # nvidiaChat.js, nvidiaImage.js, pollinations.js,
                          # withRetry.js, AiError.js
  tasks/                  # interpret.js, explain.js, buildImagePrompt.js, generateImage.js
  lib/                    # validate.js, parseJson.js, cache.js, usage.js, rateLimit.js
  routes/ai.js            # /api/interpret /explain /text-from-image /text-from-text
                          # /image-from-image /image-from-text /usage
  scripts/                # probe-step*.js (unit probes), smoke.js (live, spends quota)
client/src/api/ivlaApi.js # fetch wrappers, errors -> { code, message, canTypeInstead }
```

- Grade levels: `auto | primary | middle | high | college` (remembered in localStorage).
- Quota: `GET /api/usage` counts NVIDIA calls this session (warns after 15).
  Identical requests hit an in-memory cache (max 50) and don't recount.
  AI routes are rate-limited (20/min/IP); double-taps share one in-flight request.
- Errors are `{ error: { code, message, canTypeInstead: true } }` — every failure
  state offers Type-it-instead (works with no capture) and Try again.

## Smoke test (spends quota — run sparingly)

`node server/scripts/smoke.js` makes exactly ONE call each (vision with a tiny
generated PNG, text, image) and prints PASS/FAIL plus response SHAPES only
(never content, never the key). This spends ~4 of the small NVIDIA trial
requests. With an empty key it prints SKIP and spends nothing. I have NOT run
it live; run it yourself after configuring the key.

## Probes (free, no network)

```bash
node server/scripts/probe-step1.js  # withRetry + validators (18 checks)
node server/scripts/probe-step2.js  # parseJsonLoose + fallback order + budget (13 checks)
node server/scripts/probe-step3.js  # explanation normalize (4 checks)
node server/scripts/probe-step4.js  # cache + in-flight (6 checks)
node server/scripts/probe-step7.js  # extractImage + prompt cleaning + empty-base64 no-retry (18 checks)
```

## Tools

Pen (pressure-aware), stroke Eraser, Shapes (rect/ellipse/line/arrow) with live
preview, Select (move + Delete), Undo/Redo (100 steps, Ctrl+Z / Ctrl+Shift+Z /
Ctrl+Y), Clear (confirm, undoable), AI Circle lasso (marching-ants, validates,
masks + crops the region, shows CapturePreview with the PNG data URL stored in
App state as `{ dataUrl, bounds, path }` for Phase 2).

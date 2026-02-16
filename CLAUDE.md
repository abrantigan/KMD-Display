# KMD Piano Data Viewer

## Project Overview
Single-file HTML app (`kmd-display.html`) that displays piano measurement data from KMD (Keyboard Measuring Device) JSON files. Lets users view touchweight curves, key metrics, and share results without the $1000 device.

**Repo:** https://github.com/abrantigan/KMD-Display

## Key Files
- `kmd-display.html` — The entire app (HTML + CSS + JS, ~990 lines). No build step.
- `Example Files/example-key-data.json` — Sample data (75 of 88 keys, piano "Tom-Mason")
- `Example Files/example-graph-screenshot.png` — Reference screenshot from actual KMD device
- `tests/test-kmd-data.js` — 89 unit tests
- `.github/workflows/tests.yml` — CI runs tests on every PR and push to main

## Running Tests
```
node tests/test-kmd-data.js
```

## Architecture
- Chart.js v4 + annotation plugin loaded from CDN (two `<script>` tags in `<head>`)
- "Save Shareable HTML" works by base64-encoding the JSON into a `<script type="application/json">` tag inside a copy of the HTML. The init function detects embedded data and loads it automatically.
- `ORIGINAL_HTML` is captured at script start (before DOM changes) and used as the template for shareable exports.

## JSON Data Structure
```
pianoname: string
numkeys: string ("88")
startingnoteindex: number (0)
keynumber_data: [null, 1, 2, ..., N]     — index 0 is always null
xyvalues_data: [null, [{x,y},...], ...]   — 100 points per key (first 50 down, last 50 up)
twwindow_data: [null, [{x,y},{x,y}], ...]— 2 points defining analysis window
downweight_data: [null, float, ...]
upweight_data: [null, float, ...]
balanceweight_data: [null, float, ...]    — equals (DW + UW) / 2
friction_data: [null, float, ...]         — equals (DW - UW) / 2
keydip_data: [null, float, ...]
```

## Key Technical Details
- Key 1 = A0 through Key 88 = C8 (standard piano mapping)
- Touchweight analysis window is stored per-key in `twwindow_data` (the KMD can vary it). In the example file all 75 keys use 2.0mm–4.5mm, but don't hardcode this — always read from the data.
- Chart height uses `clamp(300px, 58vh, 600px)` for responsive scaling

## Critical Gotchas
1. **display:none CSS trap** — `#app` and `#grid-view` have `display:none` in CSS. Setting `.style.display = ''` does NOT show them (falls back to CSS rule). Must use explicit values: `'flex'` for #app, `'block'` for #grid-view.
2. **Flex container width** — Children of `#app` (flex column) with `margin: 0 auto` need explicit `width: 100%` or they shrink-wrap instead of filling available space.
3. **Chart sizing** — Don't use `flex: 1` on chart containers; it causes unbounded growth. Use viewport-relative heights with clamp().

## Session Handoff Protocol
At the end of every session, update this section with what was done.

### Session 1 — 2026-02-15/16
- Fixed blank page bug (display:none CSS override)
- Created GitHub repo
- Improved responsive layout (flex column, viewport-relative chart height)
- Fixed grid view width bug
- Created 89 unit tests + GitHub Actions CI

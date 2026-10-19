# TRIANGULA / AFTER HOURS

A complete two-player online game of dots and territory. Original crimson/cyan comic styling, exact integer geometry, authoritative multiplayer, mobile touch and keyboard play. No accounts, paid services, API keys, database, or router configuration.

## Fastest path: Mac → friend anywhere

1. Install **Node.js 22.12+ or 24 LTS** from <https://nodejs.org>. Install Cloudflare Tunnel using `brew install cloudflared` (Homebrew: <https://brew.sh>). The launcher detects `/opt/homebrew/bin` and `/usr/local/bin`. It explains missing tools; it never installs system software silently.
2. Extract the project ZIP, open Terminal, and run (replace the path; keep the quotes):

   ```bash
   cd "/path/to/triangula"
   chmod +x Start-Online.command
   ./Start-Online.command
   ```

   You can subsequently double-click `Start-Online.command` in Finder. If macOS blocks an extracted launcher, use the Terminal commands above; no global security settings need changing.
3. Wait for **PLAY ONLINE: https://…trycloudflare.com**. The launcher opens it in your browser. Enter your name, **Create a Room**, then **Copy Invite**. Send that link (or the eight-character room code plus the public site URL) to your friend.
4. Your friend opens the public link on any modern browser, enters a name, and joins. Choose a board in the lobby, have both players ready up, then the host starts.
5. Keep Terminal open, your Mac connected to the internet, its lid open, and the Mac awake. The launcher uses macOS `caffeinate` where available. Press **Control+C** in its Terminal to stop both the game and its tunnel. It stops only its own child processes.

**Never send a localhost invite to a remote friend.** Open the public HTTPS URL before creating/copying your invite. The lobby warns when opened locally. Each Quick Tunnel launch can have a different URL. Cloudflare's temporary tunnel availability is outside the game's control. Restarting the Node server removes all rooms and tokens; players must create a new room.

The launcher installs dependencies from the lockfile if needed, always builds fresh source, starts the server, checks `/health`, creates a Quick Tunnel, extracts its HTTPS URL, then restarts only its own server with that **exact allowed browser origin** before opening the page. This early restart occurs before any room is created. The production app and Socket.IO share **one port**. By default the server binds only `127.0.0.1`.

Use another port if needed:

```bash
PORT=4000 ./Start-Online.command
```

## Manual local use / development

Requirements: Node 22.12+ or 24, npm. Cloudflared is needed only for public hosting.

```bash
npm ci --include=dev
npm run build
npm start
```

Open `http://127.0.0.1:3000` locally. Two browser profiles or separate browsers can play independently. Normal tabs in one profile share the same saved seat; opening the same seat elsewhere transfers its connection to the newest tab.

For hot-reloading development, run these in **two Terminals**:

```bash
npm run dev          # authoritative Express/Socket.IO server on 3000
npx vite             # frontend on 5173; proxies Socket.IO and health to 3000
```

Open `http://localhost:5173`. Expose only the production single-port server to a public tunnel, not Vite. No worktree is required; use the existing checkout.

Environment settings are listed in `.env.example`. They are ordinary exported shell variables; `.env` is not loaded automatically. Examples:

```bash
PORT=4000 HOST=127.0.0.1 npm start
DISCONNECT_GRACE_MS=120000 ROOM_TTL_MS=14400000 npm start
```

For an independently managed tunnel set `ALLOWED_ORIGINS` to its **exact** HTTPS origin, then restart the server. Multiple origins can be comma-separated. Localhost origins on the configured port and Vite's default 5173 are allowed. Arbitrary forwarded headers are not trusted. Do not set a wildcard origin. The launcher handles this for Quick Tunnels.

## Rules

- Two players alternate drawing one undirected straight line between two existing dots. The board never adds or moves dots after start. There are no automatic boundary edges.
- No duplicate/reversed edges, crossings, overlaps, lines through other dots, or touching another line's interior. Sharing an endpoint is legal. An illegal move leaves the entire game unchanged.
- Completing an **empty triangular face** captures it for whoever drew the final edge, irrespective of the other edges' authors. A triangle containing another dot, a subdivided region, a degenerate triangle, or an already claimed face scores nothing. One move can capture two adjacent triangles; both are awarded.
- Capturing keeps the turn; there is no bank of extra turns. Otherwise the turn changes.
- **Area wins, not triangle count.** The server stores twice each area as an exact integer: `abs((bx-ax)*(cy-ay) - (by-ay)*(cx-ax))`. Display values divide by two. Percentages always use the fixed convex hull area of all board dots. Only display percentages are rounded, so a displayed 50.0% each is not necessarily an exact tie.
- The game ends when **no legal undrawn edge** remains, even if the final move scores. The larger exact total wins; equal totals draw. Resignation and explicitly claimed disconnect victories are identified separately.
- Small / standard / large have 12 / 20 / 30 dots. Jittered-grid and minimum-spaced scatter layouts are generated from a server seed. Integer coordinates, pair spacing, non-collinearity, tiny-triangle filtering, bounded attempts, and prevalidated fallback layouts keep boards reliable.
- First starter is random. Rematches require both players' consent, create a new seeded board and match ID, clear scores/history, and alternate the starting player. Either player may return a finished match to the lobby.

### Controls and accessibility

Click/tap one dot, then another. Selection has a ring and a pointer preview. Candidate dots show valid/invalid outlines; invalid choices explain why. Mobile taps use the nearest dot within a generous screen-space radius, so hit targets scale with the display. Board gestures do not interfere with the normal page outside the board.

Tab focuses dots. Enter / Space selects; Escape clears selection or closes a dialog. Modal focus is trapped, visible focus is provided, and turn changes, errors, captures and results have live announcements. Ownership uses player labels and cyan diagonal hatching as well as color. Use the header sound button to unmute; audio starts only after interaction. Reduced-motion settings honor the OS preference and can be changed in the footer. Fonts and licenses are bundled under `public/fonts` with no runtime font requests.

### Rooms, privacy, reconnection

Room codes are unpredictable eight-character invitations, **not authentication**. Each seat receives a separate 256-bit reconnect token saved only in that browser's local storage. Tokens are never put in invite URLs or public room snapshots. Only a socket authenticated to a seat can act as that player. Keep browser storage available to restore a seat after refresh. Clearing storage loses that token.

Gameplay pauses when anyone disconnects. Seats are reserved for 120 seconds by default. Returning with the token restores a full authoritative snapshot. After the countdown the remaining player can **explicitly claim a disconnect win**, or resign/leave; nobody is silently replaced during a match. Lobby hosts transfer when they leave; disconnected lobby seats expire after the grace period. Fully abandoned rooms/sessions are cleaned after four hours by default.

The server validates every event, payload, name, edge index, settings and state transition. A unique match ID, increasing revision and unique action ID prevent old-board actions and out-of-turn commits; a bounded per-session replay cache makes acknowledgement retries idempotent. Client scores/geometry are never accepted. Mutations run synchronously on one Node event loop. Request/body limits, room limits and rate limits constrain abuse. No persistence or horizontal scaling is implemented; use one server process.

## Tests

```bash
npm test                 # geometry, board generation, game engine, real Socket.IO clients
npm run check            # strict TypeScript
npm run build            # types + production frontend + server
npm run test:launcher    # after build: controlled tunnel + launcher lifecycle tests
npx playwright install chromium
npm run test:browser     # production server; separate desktop + mobile browser contexts
```

If Chromium is already installed, skip the browser download:

```bash
CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

Browser artifacts go into the ignored `.playwright` directory. The tests use port 3000 and require it to be free. See [TEST-RESULTS.md](TEST-RESULTS.md) for the actual validation performed and platform limits. Geometry tests cover intersection/touch/overlap, canonical edges, exact areas, enclosing/empty faces, double captures, no duplicate scoring and exhaustion. Integration tests connect independent actual Socket.IO clients, validate authority, retries, stale revision/ID rejection, reconnection, synchronized snapshots, a complete match, resignation, disconnect victory, host transfer and mutual rematch. Browser tests exercise keyboard/touch, invite prefill, refresh, result and rematch flows.

## Troubleshooting

- **Port busy:** stop the previous launcher with Control+C, or select another `PORT`. Never kill all Node processes.
- **Missing Node/npm/cloudflared:** install the named prerequisites, reopen Terminal and rerun. Supported Node versions are 22.12+ and 24 LTS.
- **Dependency install fails:** check internet access to `registry.npmjs.org`. Use `npm ci --include=dev`; do not remove the lockfile or disable TLS verification.
- **Tunnel never produces a URL / exits:** inspect the launcher output, check internet access and your `cloudflared` installation, then retry. A Quick Tunnel can be unavailable temporarily. Public hosting needs Cloudflare's network and outbound tunnel traffic, commonly port 7844.
- **Public page loads but remains reconnecting:** use the current launcher URL, not an earlier launch's URL. Manual hosting needs the public origin in `ALLOWED_ORIGINS`. Check browser network access; do not broaden origin policy to `*`.
- **Room missing / saved room expired:** server restart or cleanup removed the in-memory room. Create a new room. A room code cannot recover a lost player token.
- **Room full:** only two seats exist. A disconnected player's seat remains reserved; refreshing with that player's browser restores it.
- **Stale state / network interrupted:** wait for the authoritative snapshot, then retry. A move may have committed even if its acknowledgement was lost; retry deduplication avoids an extra move.
- **Mac sleeps / lid closed:** reopen the lid and keep power/network available. `caffeinate` prevents idle sleep, not forced sleep or shutdown.
- **Browser support:** recent Safari, Chrome, Firefox or Edge. iPhone/Android users only need the HTTPS invite; they install nothing. Web Audio may require an extra interaction after enabling sound.

## Project map and licenses

`src/shared/geometry.ts` — exact geometry shared for previews and server checks. `src/server/engine.ts` — authoritative scoring/turns. `src/server/board.ts` — seeded generation. `src/server/app.ts` — rooms, authentication, protocol and cleanup. `src/client` — React/SVG interface. `Start-Online.command` — Mac hosting. `tests` — automated verification.

Original application code and artwork: MIT, see `LICENSE`. Local Barlow Condensed and DM Sans fonts: SIL Open Font License, see their individual bundled licenses. No Persona characters, logos, music or artwork are used. Dependency licenses remain with their respective packages.

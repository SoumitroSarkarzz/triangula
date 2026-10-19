# Validation performed

Validated on 19 October 2026 in the Linux cloud workspace with Node.js 24.19.0, npm 11.9.0 and system Chromium 154.0.8037.57.

| Check | Result |
| --- | --- |
| `npm ci --include=dev --no-audit --no-fund` | Passed, actual frozen-lockfile reinstall through the launcher |
| `npm run check` | Passed, strict TypeScript |
| `npm run build` | Passed, production React assets and bundled Express server |
| `npm test` | **13 passed**, zero failures/skips |
| `npm run test:launcher` | **2 passed**, zero failures/skips |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser` | **1 passed**, zero failures/skips |
| `npm audit` | Zero reported vulnerabilities |
| `bash -n Start-Online.command` | Passed |

## What those checks exercised

- Exact integer areas, hull area, crossing and interior-touch rejection, shared endpoints, duplicate/reversed edges, third dots, overlaps, degeneracy, enclosing-shape rejection, empty faces, two captures from one edge, no double scoring and legal-move exhaustion.
- Turn changes, capture turn retention, invalid moves leaving the full game unchanged, exact ties, resignation, and fresh match state with alternating starters.
- Reproducible generation across 360 seed/size/layout combinations, plus the prevalidated fallback layouts: correct counts, padded boundaries, meaningful hull area, pair spacing and no collinear triples.
- Actual independent Socket.IO connections creating/joining a room; rejection of an extra seat, unauthenticated actions, wrong turns, invalid tokens, stale revisions and stale match IDs; idempotent repeated action IDs; disconnect pause and token reconnect; synchronized snapshots; a whole match to legal-move exhaustion with captured area equal to hull area; mutually agreed rematch; resignation; host transfer; explicit grace-period disconnect victory; invalidated rooms; origin rejection.
- Two separate Chromium browser contexts: 1440×1000 desktop host and 390×844 mobile/touch guest. Invite prefill, creation/join/readiness/start, keyboard-selected and click/touch-selected moves, identical edge counts, refresh restoring a seat, no horizontal mobile overflow, resignation/results, mutual rematch and help dialog. No browser page errors. Desktop and mobile screenshots were inspected.
- Controlled launcher tests use a real Node production server and a simulated tunnel executable: paths containing spaces, health readiness, URL parsing, exact public WebSocket origin acceptance, browser-open URL, SIGINT cleanup, tunnel-exit failure, and confirmation that only the owned tunnel/server stop. They do **not** establish public Cloudflare connectivity.

## Platform and network limits

The actual `Start-Online.command` was also run with the official cloudflared 2026.10.1 Linux binary, verified against the release's published SHA-256 checksum. Locked installation, build and local server startup succeeded. The Quick Tunnel attempt **failed** when cloudflared could not resolve/reach `api.trycloudflare.com` through this cloud machine's DNS/network. The launcher reported the failure and cleaned up its server and tunnel. No live public tunnel or worldwide connection is claimed.

Apple Silicon/macOS, Finder launching, macOS browser opening and caffeinate behavior were not executed on this Linux machine. Safari, Firefox, Edge, physical Android/iPhone hardware, and real internet latency were not tested. The launcher uses macOS bash 3.2-compatible syntax and standard Homebrew paths, but should be verified on the host Mac. Follow README.md to run it there. Cloudflare availability and keeping the Mac online remain external prerequisites.

The source ZIP contains no dependencies or platform-specific binaries; `npm ci` installs the correct packages for the host. Rooms are intentionally in memory. Restarting the server invalidates them.

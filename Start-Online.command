#!/bin/bash
# macOS bash 3.2 compatible. No global process kills; all children belong to this run.
set -euo pipefail
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PORT="${PORT:-3000}"
case "$PORT" in ''|*[!0-9]*) echo 'PORT must be a number.'; exit 1;; esac
if (( PORT < 1 || PORT > 65535 )); then echo 'PORT must be 1–65535.'; exit 1; fi
for tool in node npm cloudflared; do
 if ! command -v "$tool" >/dev/null 2>&1; then
  echo "Missing $tool. Install Node.js 22.12+ or 24 LTS from https://nodejs.org and Cloudflare Tunnel with: brew install cloudflared"
  echo 'Then run this launcher again. No system software was installed.'
  exit 1
 fi
done
node -e 'const [n,m]=process.versions.node.split(".").map(Number);if(!((n===22&&m>=12)||n===24)){console.error("Use Node.js 22.12+ or 24 LTS.");process.exit(1)}'
SERVER_PID=''; TUNNEL_PID=''; WAKE_PID=''
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/triangula.XXXXXX")"
cleanup(){
 trap - EXIT INT TERM
 for child in "$SERVER_PID" "$TUNNEL_PID" "$WAKE_PID"; do
  if [ -n "$child" ]; then kill "$child" 2>/dev/null || true; wait "$child" 2>/dev/null || true; fi
 done
 rm -rf -- "$RUN_DIR"
 echo; echo 'Triangula stopped. This launcher’s server and tunnel have been closed.'
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# A content hash avoids stale dependencies/builds, including when extracting an updated ZIP.
STAMP="$(node -e 'const f=require("fs"),c=require("crypto");process.stdout.write(c.createHash("sha256").update(f.readFileSync("package-lock.json")).digest("hex"))')"
if [ ! -d node_modules ] || [ ! -f node_modules/.triangula-lock ] || [ "$(cat node_modules/.triangula-lock 2>/dev/null)" != "$STAMP" ]; then
 echo 'Installing locked dependencies…'
 npm ci --include=dev --no-audit --no-fund
 echo "$STAMP" > node_modules/.triangula-lock
fi
# Always build: this is quick and ensures edited source never launches a stale frontend.
echo 'Building Triangula…'
npm run build
node -e 'const n=require("net").createServer();n.once("error",()=>{console.error("Port is already in use. Try PORT=4000 ./Start-Online.command");process.exit(1)});n.listen(+process.argv[1],"127.0.0.1",()=>n.close())' "$PORT"
start_server(){
 HOST=127.0.0.1 PORT="$PORT" ALLOWED_ORIGINS="${1:-}" node dist/server.js >"$RUN_DIR/server.log" 2>&1 &
 SERVER_PID=$!
 for ((i=0;i<100;i++)); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then cat "$RUN_DIR/server.log"; echo 'Server exited during startup.'; exit 1; fi
  if node -e 'fetch("http://127.0.0.1:"+process.argv[1]+"/health").then(async r=>{const j=await r.json();process.exit(r.ok&&j.service==="triangula"?0:1)}).catch(()=>process.exit(1))' "$PORT" >/dev/null 2>&1; then return; fi
  sleep .2
 done
 cat "$RUN_DIR/server.log"; echo 'Server health check timed out.'; exit 1
}
start_server ''
echo 'Opening a temporary Cloudflare HTTPS tunnel…'
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >"$RUN_DIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!
PUBLIC_URL=''
for ((i=0;i<120;i++)); do
 if ! kill -0 "$SERVER_PID" 2>/dev/null; then cat "$RUN_DIR/server.log"; echo "Game server exited while opening the tunnel."; exit 1; fi
 if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then cat "$RUN_DIR/tunnel.log"; echo 'Cloudflare Tunnel exited. Check your connection and try again.'; exit 1; fi
 PUBLIC_URL="$(node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");process.stdout.write(s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0]||"")' "$RUN_DIR/tunnel.log")"
 if [ -n "$PUBLIC_URL" ]; then break; fi
 sleep .5
done
if [ -z "$PUBLIC_URL" ]; then cat "$RUN_DIR/tunnel.log"; echo 'No public URL received. Try again later.'; exit 1; fi
# Restart only our server with the precise public origin, before creating any rooms.
kill "$SERVER_PID"; wait "$SERVER_PID" 2>/dev/null || true; SERVER_PID=''
start_server "$PUBLIC_URL"
if command -v caffeinate >/dev/null 2>&1; then caffeinate -i -w "$SERVER_PID" & WAKE_PID=$!; fi
echo
echo '══════════════════════════════════════════════════════════'
echo "  PLAY ONLINE: $PUBLIC_URL"
echo '══════════════════════════════════════════════════════════'
echo 'Open THIS public URL, create a room, then copy its invite.'
echo 'Do not send friends a localhost link. Keep this Terminal open.'
echo 'Keep your Mac awake, lid open, and connected. Control+C stops hosting.'
echo 'Quick Tunnel URLs change each launch; availability depends on Cloudflare.'
if command -v open >/dev/null 2>&1; then open "$PUBLIC_URL" || true; fi
while true; do
 if ! kill -0 "$SERVER_PID" 2>/dev/null; then cat "$RUN_DIR/server.log"; echo 'Game server exited.'; exit 1; fi
 if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then cat "$RUN_DIR/tunnel.log"; echo 'Tunnel exited. Your old invite is no longer online.'; exit 1; fi
 sleep 1
done

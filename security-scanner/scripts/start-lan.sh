#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_PORT="8002"
LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{ for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit } }')"

if [[ -z "$LAN_IP" ]]; then
  echo "Could not detect this computer's LAN IPv4 address. Connect to Wi-Fi and retry."
  exit 1
fi

API_BASE_URL="http://$LAN_IP:$API_PORT/api/v1"
HTTP_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' --connect-timeout 2 --max-time 4 --header 'Accept: application/json' "$API_BASE_URL/auth/me" || true)"

if [[ "$HTTP_STATUS" != "200" && "$HTTP_STATUS" != "401" ]]; then
  echo "EUEvent API did not respond as expected at $API_BASE_URL (HTTP $HTTP_STATUS)."
  echo "Start it from the backend directory with: php artisan serve --host 0.0.0.0 --port $API_PORT"
  exit 1
fi

echo "EUEvent API: $API_BASE_URL (HTTP $HTTP_STATUS)"
echo "Use Expo Go on the same Wi-Fi and scan the LAN QR code."
echo "If the app has an older saved address, open Settings > Change and save this URL."

cd "$APP_DIR"
EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL" npx expo start --lan --go

# EUEvent student and security mobile app

This Expo / React Native app supports both student and security-staff accounts.

- **Students** sign in with their institutional account, load their tickets, and display a QR proof generated on-device. The proof rotates every 30 seconds; the ticket seed is kept in Expo SecureStore.
- **Security staff** sign in with their staff account, see only assigned gates, download a gate manifest, and scan student tickets. The scanner validates the rotating proof against the local manifest and queues scans while offline.
- **Offline sync** stores pending scan data in an encrypted SQLite queue. Each optical scan keeps the same UUID when retried. The app syncs batches when the Laravel API is reachable again.

## Run on Fedora with Expo Go

For the isolated Lerd presentation setup, first prepare and start the local API as described in the [backend presentation guide](../backend/README.md#local-presentation-mode).

Then, from `security-scanner/`:

```bash
npm install
npm run start:lan
```

The LAN launcher checks the API on port 8002, detects Fedora's active LAN IPv4 address, and starts Expo Go with the matching `/api/v1` base URL. Keep the Metro terminal open during the demo and connect the phone to the same Wi-Fi as Fedora.

If the app has an old server address saved, open the app's server settings, enter the full API base URL including `/api/v1`, test it, and save it. For example:

```text
http://<FEDORA_LAN_IP>:8002/api/v1
```

Changing the server clears the saved sign-in because each API issues its own session token. Session tokens and student ticket seeds are kept in Expo SecureStore.

## Before doors open

1. Sign in as security staff and download the manifest for the assigned event gate while connected.
2. Have students load their tickets before they approach the entrance.
3. The scanner can validate downloaded tickets and queue results without reaching Laravel. Reconnect later to submit pending batches and receive server decisions.

The scanner device clock is the time reference for validating a rotating QR code. A cancellation or revocation made while a scanner is offline cannot reach that device immediately; its local decision remains provisional until sync.

## Checks

```bash
npm run lint
npx tsc --noEmit
```

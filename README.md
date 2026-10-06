# EUEvent Offline Ticketing

EUEvent is the MSEUF event ticketing and gate-access system. Laravel is the authoritative API and database layer. A browser dashboard handles administration; one Expo mobile app provides student ticket wallets and the security scanner.

## End-user roles

- **Students** sign in on mobile and display their issued event tickets. Each ticket shows a short-lived QR proof that rotates every 30 seconds.
- **Security staff** use the mobile scanner at their assigned gates. They download the gate manifest before entry starts, validate tickets on-device, and can queue scans while offline.
- **Administrators** use the desktop dashboard to manage student and security-staff accounts, venues and gates, events, ticket issuance, gate assignments, and activity logs.

## Ticket and scan flow

1. An administrator creates an event, assigns venue gates and staff, and issues tickets to student accounts.
2. A student signs in and loads their tickets. The ticket's TOTP seed is stored in the phone's secure storage; the app generates the rotating QR proof locally.
3. Security staff download the assigned gate manifest while connected. During an outage, the scanner checks the QR proof against that local manifest and puts the scan in an encrypted local queue.
4. When the API is reachable again, the scanner syncs batches using stable scan IDs. Laravel verifies the proof and event/gate rules, records the result, and safely acknowledges retries.

Offline decisions are provisional until the server receives the scan. A scanner cannot learn about a cancellation or ticket revocation while disconnected. An event team should preload manifests before doors open and sync queued scans when connectivity returns.

## Architecture

| Component | Responsibility |
| --- | --- |
| `backend/` | Laravel 13 API, PostgreSQL persistence, Sanctum authentication, ticket issuance, TOTP verification, scan reconciliation, and audit records |
| `admin-web/` | React, TypeScript, and Vite administrator dashboard |
| `security-scanner/` | Expo and React Native student wallet and security scanner; Expo SecureStore, SQLite, camera scanning, and offline sync |
| `docs/` | API contracts and implementation documentation |
| `architecture/` | System architecture and architecture decision records |

The shared development environment can use Supabase PostgreSQL. Fedora presentation mode uses a separate local PostgreSQL database managed by Lerd; it does not use Supabase.

## Local presentation setup on Fedora

Requirements: PHP 8.5, Composer, Node.js 22 with npm, Lerd with its PostgreSQL service, and Expo Go on a phone connected to the same Wi-Fi network.

1. Install backend dependencies and prepare the isolated demo database:

   ```bash
   cd backend
   composer install
   ./scripts/setup-presentation-demo.sh
   ```

   The script creates `backend/.env.demo`, runs migrations, and seeds a demo administrator, venue, and gate. The generated administrator password is kept in that ignored file:

   ```bash
   grep '^EUEVENT_DEMO_ADMIN_PASSWORD=' .env.demo
   ```

2. Start the local API in a terminal:

   ```bash
   cd backend
   ./scripts/start-presentation-demo.sh
   ```

   The API listens on port 8002.

3. Configure and start the administrator dashboard in another terminal:

   ```bash
   cd admin-web
   cp .env.example .env
   npm install
   npm run dev -- --host 0.0.0.0
   ```

   For the isolated presentation API, set `VITE_BACKEND_ORIGIN=http://127.0.0.1:8002` in `admin-web/.env`. Open the Vite address printed in the terminal. Create student and staff accounts through the dashboard before issuing tickets.

4. Start the mobile app:

   ```bash
   cd security-scanner
   npm install
   npm run start:lan
   ```

   The launcher checks the API, detects Fedora's current LAN IP, and passes the API address to Expo Go. Scan the Expo QR code with the phone. If the app has an old server URL saved, update it in the app's server settings.

For the complete presentation database safeguards and network notes, see [backend local presentation instructions](backend/README.md#local-presentation-mode).

## Development checks

Run the backend tests from `backend/`:

```bash
php artisan test --compact
```

PHPUnit uses an in-memory SQLite database for tests; the test suite does not need Supabase credentials. Format backend PHP with:

```bash
vendor/bin/pint --dirty --format agent
```

Build the dashboard from `admin-web/` with `npm run build`. Check the Expo app with `npm run lint` and `npx tsc --noEmit` from `security-scanner/`.

## More documentation

- [Presentation run of show, system walkthrough, roadmap, and speaker notes](docs/presentation/README.md)
- [Backend API and demo setup](backend/README.md)
- [Administrator dashboard](admin-web/README.md)
- [Student and scanner mobile app](security-scanner/README.md)
- [API contract](docs/api.md)
- [System overview](architecture/01-system-overview.md)
- [Offline sync and security design](architecture/08-cryptographic-and-offline-sync-engine.md)
- [Testing strategy](architecture/11-testing-and-verification-strategy.md)

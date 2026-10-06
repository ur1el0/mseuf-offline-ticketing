# EUEvent Laravel backend

This directory contains the PHP 8.5 / Laravel 13 API. It owns authentication, role checks, event and venue data, ticket issuance, encrypted ticket seeds, scan reconciliation, and audit history. The React dashboard and Expo app use its versioned `/api/v1` JSON endpoints.

## Main API areas

- Authentication and role-specific student, security-staff, and administrator access.
- Administrator management for students, staff, venues, gates, events, gate assignments, and ticket issuance.
- Administrator event-ticket roster and audited revocation workflow.
- Student ticket wallet and staff gate-manifest endpoints.
- Scanner batch synchronization with TOTP verification, gate/event checks, idempotent scan IDs, and anomaly logging.
- Administrator metrics and activity logs.

Sanctum bearer tokens expire after 24 hours by default. Set `SANCTUM_EXPIRATION_MINUTES` in `.env` to change that lifetime; mobile clients must sign in again after expiry before protected API calls or scan synchronization can continue.

Controllers handle HTTP input and responses. Form Requests validate and authorize requests; application services apply event and ticket rules in database transactions; Eloquent models map the PostgreSQL schema.

## Local development

Install dependencies and configure `.env` for the database and app key used by your local Laravel environment:

```bash
composer install
cp .env.example .env
php artisan key:generate
```

Set the local database values in `.env` before running migrations. Never commit `.env`, database credentials, or encryption keys.

For a safe demo database isolated from Supabase, follow the [local presentation mode](#local-presentation-mode).

## Tests and quality checks

From this directory:

```bash
php artisan test --compact
vendor/bin/pint --dirty --format agent
php artisan route:list --path=api/v1
```

The PHPUnit configuration uses in-memory SQLite. Tests cover student ticket access, assigned-gate manifests, offline scan reconciliation and retries, role checks, token expiry, ticket revocation, audit decisions, and presentation seeding without contacting Supabase.

## Local presentation mode

Use this mode when the venue's internet connection is unreliable. Fedora runs the API and a dedicated PostgreSQL database locally; a phone and dashboard computer reach them over the same Wi-Fi network. This database is separate from Supabase and contains local demo data.

### One-time setup

Install Composer dependencies, then from `backend/` run:

```bash
./scripts/setup-presentation-demo.sh
```

The script uses the Lerd PostgreSQL container, creates a dedicated `euevent_demo` database and login, generates local credentials, runs migrations, and seeds an administrator, a venue, and Gate A. It writes secrets to the ignored, owner-readable-only `.env.demo`. It does not change `.env` or contact Supabase. The seeder refuses to run outside Laravel's `demo` environment.

The demo administrator email is `demo-admin@euevent.test`. Read the generated password locally with:

```bash
grep '^EUEVENT_DEMO_ADMIN_PASSWORD=' .env.demo
```

Keep the password on the presentation computer. Create student and security-staff accounts in the dashboard before issuing tickets or testing scans.

### Start the API

From `backend/`:

```bash
./scripts/start-presentation-demo.sh
```

The API listens on port 8002 on Fedora's LAN interfaces. Keep that terminal open.

### Network behavior

The API, database, dashboard, and mobile traffic stay on the local network. A healthy local Wi-Fi connection is still needed for phones and other computers to reach Fedora. The mobile scanner must download its assigned gate manifest before operating offline. If the local Wi-Fi itself fails, Expo Go may also lose its JavaScript bundle connection to Metro; use an installed standalone build for a presentation that must survive loss of that Wi-Fi.

The scanner queues validated scans locally and syncs when the API becomes reachable. During a disconnection it cannot receive event cancellations, revocations, or changed gate assignments, so offline acceptance is provisional until server reconciliation.

The LAN IP may change when the router renews its DHCP lease. The scanner's `npm run start:lan` launcher detects the current address. A DHCP reservation can keep the address stable if the presentation router is under your control.

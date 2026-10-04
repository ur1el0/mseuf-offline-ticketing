# ADR 011: Use an Isolated Local Database for Presentations

- Status: Accepted
- Date: 2026-10-04

## Context

The shared development environment uses Supabase PostgreSQL. A presentation venue may have slow or unavailable internet, while the event flow needs a reachable Laravel API for setup and scan reconciliation. The scanner can validate from a previously downloaded manifest during a disconnection, but the current Laravel server still depends on the internet when its database is Supabase.

## Decision

- Use Lerd-managed PostgreSQL on the Fedora presentation host as an alternate, isolated demo environment.
- Select the demo environment with Laravel's environment-specific .env.demo file and the Artisan --env=demo option.
- Keep the regular .env and its Supabase credentials unchanged.
- Give the demo database its own database role, Laravel APP_KEY, administrator account, venue, and gate. Generate credentials locally and keep them in ignored backend/.env.demo.
- Require the presentation seeder to verify that the application environment is demo.
- Point local mobile and admin clients at the Fedora API over the presentation LAN.
- Treat local presentation data as a disposable independent dataset. No automatic replication to Supabase is included.

## Consequences

- Event setup, ticket issuance, manifest download, scan reconciliation, and audit review can use local PostgreSQL without WAN access, provided the phones remain connected to the Fedora host over the local Wi-Fi.
- A scanner disconnected from the LAN still validates from its cached manifest and queues scans locally. It can sync after it reconnects to the local API.
- Records created against the local database do not appear in the Supabase project. Copying local presentation records to Supabase requires a separate, deliberate export or synchronization process.
- Laravel migrations remain the shared schema definition and can initialize either PostgreSQL environment.
- The local API must not be represented as a production deployment; credentials and host access are limited to the presentation network.

## Laravel environment behavior

Laravel can select an environment-specific file with the Artisan --env option. Configuration caching skips loading environment files, so the local setup scripts clear the cached configuration before switching to demo. See the Laravel 13 configuration guide: https://laravel.com/docs/13.x/configuration.

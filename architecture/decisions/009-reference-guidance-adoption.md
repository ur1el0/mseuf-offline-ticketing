# ADR 009: Selective Adoption of External Reference Material

- Status: Accepted
- Date: 2026-10-01

## Context

The project received API, architecture, and decision-document examples for a separate ticketing system named Ingress. They contain useful API documentation, concurrency, threat-model, accessibility, and demo-credential practices. They also prescribe a different stack, schema, route set, QR credential, and server-only scanning model. Copying those specifics would contradict EUEvent's accepted three-role, rotating-TOTP, offline-scanner design.

## Options considered

1. Adopt the reference system as a replacement architecture.
2. Ignore every part of the reference, including its reusable engineering practices.
3. Adopt compatible documentation and safety practices, and reject incompatible product and implementation choices.

## Decision

Choose option 3. EUEvent keeps its existing Laravel + Supabase backend, React administrator web client, Expo student/scanner mobile clients, `student` / `security_staff` / `administrator` roles, gate-partitioned offline manifest, rotating RFC 6238 ticket, `scan_id` sync idempotency, and reconciliation-based conflict handling.

Adopt these practices for future work:

- state endpoint access, request/response fields, error outcomes, and retry behavior;
- document concurrency invariants and test their expected outcomes;
- describe what a database-only and database-plus-key compromise would expose;
- verify authorization and minimize PII and credential exposure;
- do not add predictable demo credentials without an off-by-default opt-in and production guard;
- render operational status with both text/symbols and color.

Do not import Ingress-specific routes, table names, token formats, framework/database version assumptions, logos/colors, or its rule to deny every offline scan. Plain HTTP is not accepted as a production default because this API carries bearer tokens and ticket secrets.

## Consequences

The detailed project rules are consolidated in [`docs/architecture.md`](../../docs/architecture.md), [`docs/api.md`](../../docs/api.md), and [`docs/design-decisions.md`](../../docs/design-decisions.md). The attachments are reference material, not a second source of truth. A future change to an accepted invariant requires a new ADR and a migration plan for backend, web, and mobile clients.

This ADR does not decide the unresolved local TOTP seed persistence design. The existing SecureStore rule and SQLite manifest sketch must be reconciled before implementing that storage path.

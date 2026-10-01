# EUEvent Architecture Guide

This is the entry point for the MSEUF Offline Ticketing System architecture. The detailed specifications remain in [`architecture/`](../architecture/). This guide describes the project we are building; the supplied Ingress documents were reference material from a different design and do not replace our requirements.

## Product roles and clients

| End user | Client | Main responsibility |
| --- | --- | --- |
| Student | Mobile app | Display a securely stored, rotating digital ticket for venue entry. |
| Security Staff | Offline mobile scanner app | Validate student tickets at the door and manage physical access, including while disconnected. |
| Administrator | Desktop web dashboard | Set up events, manage gate assignments, and monitor system logs. |

These are the only portal roles: `student`, `security_staff`, and `administrator`. Gate or event assignment is scoped access for security staff; it does not create another end-user role.

## System boundaries

```text
Student mobile app ── ticket/auth API ─┐
                                       │
Offline scanner ── manifest + sync API ├── Laravel API ── Supabase PostgreSQL
                                       │
Admin web dashboard ── admin API ──────┘
```

- **Laravel** owns user identity, event and venue configuration, gate assignments, issued ticket records, audit history, and reconciliation of scanner batches.
- **Supabase PostgreSQL** is the shared server database. Migrations in `backend/database/migrations` define its schema. Credentials and service keys stay in local environment files and the hosted secret store.
- **Admin web** is a React + TypeScript desktop client. It renders server data and sends administrator actions through the versioned API. The server remains responsible for authorization and business rules.
- **Student mobile** renders the student's own ticket. The QR token rotates every 30 seconds using the ticket's TOTP seed; a static screenshot must not be treated as a valid ticket.
- **Security scanner mobile** downloads only its assigned gate's manifest, checks rotating tokens against its own clock, records accepted scans in its local queue, and syncs batches when connectivity returns.

## Offline admission and reconciliation

The scanner is allowed to validate against its preloaded manifest while offline; rejecting every scan whenever the server is unreachable would remove a core product requirement. Each scanner can only know its own local scan history while disconnected. Two disconnected gates can therefore accept the same ticket before either syncs. The server detects the conflict during reconciliation, records the anomaly, and preserves the evidence for review. The UI must not claim that offline admission prevents cross-gate replay in real time.

The scanner clock is the trust anchor for TOTP verification. Student device time is not trusted. `scan_id` is minted once per optical scan and reused on retries so a dropped acknowledgement does not create a second admission. See [TOTP and offline sync](../architecture/08-cryptographic-and-offline-sync-engine.md), [gate partitioning](../architecture/09-gate-partitioning-and-marshal-override.md), and [sync service code](../backend/app/Services/Sync/SyncScanProcessor.php).

## MVC responsibilities

- **Model/data layer:** Eloquent models and migrations represent persistent server state; Expo SQLite represents the scanner's offline manifest and pending queue.
- **Controller/API layer:** Laravel controllers handle HTTP input and responses. New request validation belongs in Form Requests. Domain services own transaction, scan reconciliation, TOTP, and authorization-sensitive business rules.
- **View/client layer:** React pages and React Native screens compose UI. Client hooks coordinate state; API, cryptographic, secure-storage, camera, and SQLite work stays in services or hooks rather than screen markup.

Do not move admission, capacity, assignment, or authorization rules into a view. Do not add microservices, WebSockets, or a second database without a measured requirement and an accepted ADR.

## Security boundaries

- The API checks role and resource assignment on every protected request. Hiding a button in a client is not authorization.
- Ticket QR data contains no student name, email, or student number.
- A TOTP seed is a secret. Never print it, the QR payload, bearer tokens, or `.env` values to logs, screenshots, analytics, or commits.
- Gate manifests are restricted to assigned security staff and must not be cached by shared HTTP caches.
- Mobile bearer tokens and cryptographic material use protected device storage.
- **Open implementation conflict:** the Expo rule says `expo-secure-store` is the exclusive store for cryptographic ticket secrets, while the scanner schema sketch in `architecture/04-mobile-scanner-expo-sqlite.md` places `totp_secret` in SQLite. Until an ADR resolves the storage design, do not persist plaintext seeds in SQLite. Update the rule and schema together before implementing manifest persistence.
- Never enable predictable demo credentials by default. If demo accounts are added, gate them behind an explicit opt-in that cannot be enabled in production.

## 30–50% milestone focus

A defensible midterm slice should demonstrate working paths across all three clients:

1. Administrator sign-in, dashboard metrics, event setup, gate assignment, and reviewable system logs.
2. Student sign-in and an owned ticket display with a rotating QR.
3. Security staff sign-in, assigned-gate manifest download, offline scan validation, local scan queue, and idempotent sync/reconciliation.
4. Clear outcomes for cancellation, postponement/rescheduling, gate mismatch, invalid or expired tickets, offline operation, and sync conflicts.

Keep unimplemented flows explicitly marked as planned. Payments, general-purpose RBAC, cloud-to-edge replication, and service decomposition are outside this milestone unless a course requirement changes.

## How to read the specifications

- [`api.md`](api.md) is the endpoint inventory and API authoring guide.
- [`design-decisions.md`](design-decisions.md) records accepted choices, UI guidance, and how to add an ADR.
- [`architecture/`](../architecture/) holds detailed schemas, workflows, endpoint examples, and domain decisions.
- Code and migrations show what is currently implemented. Architecture documents may describe planned work; each endpoint or feature must be labeled as implemented or planned rather than presented as live behavior.

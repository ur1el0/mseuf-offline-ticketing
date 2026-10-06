# How EUEvent works

## One-sentence description

EUEvent is a ticketing and venue-entry system: administrators configure events and issue tickets, students display short-lived phone-generated QR proofs, and assigned security staff validate them using a gate-specific offline copy when the API is unreachable.

## The three users and their jobs

| User | Application | Job |
| --- | --- | --- |
| Student | Expo mobile app | Sign in, load their own issued tickets, and show a rotating QR pass at the venue. |
| Security staff | Expo mobile scanner app | Sign in, download assigned gate data before doors open, scan passes, and handle physical entry. |
| Administrator | React desktop dashboard | Create accounts, configure venues/gates/events, assign staff, issue or revoke tickets, and review metrics and logs. |

The API enforces these roles. Hiding a screen or button in the app is not authorization.

## System picture

```text
 Administrator browser                  Student phone
 React + TypeScript                     Expo / React Native
          \                                  /
           \                                /
            └──────── Laravel JSON API ────┘
                         │
                  PostgreSQL database
                         │
            Scanner sync / admin logs
                         │
          Security staff phone at each gate
          Expo + camera + encrypted SQLite

  Internet can be unavailable at the venue. A preloaded scanner can
  still check tickets locally; later sync reconciles with Laravel.
```

Laravel and PostgreSQL are the authoritative record for accounts, event state, gate assignment, ticket status, and accepted scans. In the Fedora presentation mode, Laravel connects to a separate local PostgreSQL database in Lerd; that database is deliberately separate from Supabase. A phone still needs local Wi-Fi to reach Fedora when downloading data or syncing.

## The happy path, from setup to entry

1. **Provision people.** An administrator creates student and security-staff accounts. Laravel assigns the role; clients do not get to choose a privileged role during sign-up.
2. **Configure the place and event.** The administrator creates a venue and its physical gates, creates an event, associates the event with gates, and assigns staff. The event is scheduled when entry should be allowed.
3. **Issue a ticket.** The administrator identifies a student and event gate. A Laravel service performs eligibility, duplicate-ticket, event-state, and capacity checks inside a database transaction. It creates a random per-ticket TOTP secret and stores it encrypted in the database. Ticket issuance changes the event configuration version and adds an event change record.
4. **Load the student's ticket.** The student authenticates and requests `/api/v1/student/tickets`. Laravel returns only tickets belonging to that account and only makes the active QR secret available while the event can accept entry. The app stores the ticket snapshot in Expo SecureStore.
5. **Prepare a scanner.** Assigned staff authenticate and fetch their assigned gates. Before the event, the scanner downloads the relevant gate manifest. The app encrypts the local manifest with AES-GCM before persisting it in SQLite; the encryption key is in SecureStore.
6. **Create and check the QR.** The student phone computes an RFC 6238 TOTP using the secret, HMAC-SHA1, and a 30-second time step. The QR carries ticket identity, time step, and a six-digit proof, not the secret, student number, or email. The scanner uses its own clock and the locally cached ticket secret to verify the current step and gate/event/ticket status.
7. **Record the scan.** The scanner prevents a repeated scan on that same device, creates one UUID `scan_id`, and stores the encrypted scan in the local queue. It can continue scanning while a background request is unavailable or retrying.
8. **Reconcile.** When connected and authenticated, the scanner posts batches of up to 50 scans to `/api/v1/sync/batch`. Laravel verifies the proof again, checks current server state and gate assignment, locks the ticket/related records as needed, and records the accepted/rejected outcome. The scanner reuses each original `scan_id` after a timeout, so a retry does not create a second admission.

## How to read a Laravel request (Django comparison)

Follow an endpoint from the outside inward. For example, `POST /api/v1/sync/batch` follows this general path:

```text
routes/api.php
  → Sanctum authentication and security_staff role middleware
  → SyncBatchRequest (input validation / authorization boundary)
  → SyncBatchController (HTTP coordination)
  → reconciliation and scan-processing services (domain rules / transaction)
  → Eloquent models + PostgreSQL
  → JSON outcome returned to Expo
```

For a Django mental model, `routes/api.php` is near `urls.py`; middleware and Form Requests divide work that might otherwise appear in decorators, permissions, serializers, or forms; the controller resembles a thin API view; Laravel services hold the business operation; Eloquent models/query builders map to Django models and the ORM; API Resources shape the response. It is a comparison to help locate responsibility, not a claim that every Laravel class has an exact Django twin.

The React and Expo clients are separate views of the same versioned API. Business rules that protect identity, capacity, event status, or ticket use belong in Laravel and are checked again during reconciliation.

## What “offline” means here

Offline support is a prepared mode, not magic connectivity. Before the outage, a staff device must have signed in and downloaded the right event/gate manifest. The student's phone must already have its ticket snapshot and secret. During the outage:

- The student's app can keep generating the next TOTP without asking the API.
- The scanner checks the QR against its encrypted cached manifest and its own clock.
- A successful local check is displayed as **locally validated** and queued as **provisional**.
- Staff can move on to another student; a slow server sync runs separately and does not need to hold the camera flow open.
- The scanner cannot learn of a ticket revocation, event cancellation/postponement, schedule/gate change, or another scanner's admission until information reaches it.
- When service returns, server reconciliation can reject something the scanner provisionally accepted. A software rejection after the student has physically entered requires an operational response by event staff.

The local queue is encrypted in SQLite. The code proof is cleared from acknowledged local payloads; queue records remain associated with stable scan IDs and server outcomes to support retry and audit behavior. Signing out should not be used as a queue-clearing technique.

## Important fault cases

### A screenshot of a student's QR

A captured QR contains a six-digit TOTP for one 30-second time step. It becomes invalid as the scanner's time moves into the next step. The scanner rejects a QR whose encoded step is not the current step. However, a screenshot copied and presented during the same active step may still validate once on a particular scanner if that scanner has not seen the ticket. Rotating QR reduces the useful replay window; it does not prove the person holding the screenshot is the student.

### Same ticket shown at the wrong gate

Each gate receives a gate-scoped manifest. If the ticket is not in that manifest, the scanner tells staff to compare the event and gate shown on the pass with the scanner assignment; the scan must not be treated as accepted. The server also checks that the submitted gate belongs to the ticket and records a gate mismatch during sync. If a device has stale data, staff should ask the event lead to verify and refresh when connected rather than making an undocumented exception.

### Two different disconnected scanners see the same ticket

Each phone knows only its own local scan history. Both devices can provisionally accept a valid code before either synchronizes. Laravel then serializes the updates: the first valid claim may be accepted and a later distinct scan rejected as a split-brain collision. This detects a conflict after the fact; it cannot prevent the second person from physically entering during the outage. The team needs a documented offline admission procedure and enough staffed gates to manage that risk.

### Event cancellation or ticket revocation while a scanner is offline

The administrator's action changes the authoritative server record and is logged. A disconnected scanner retains the older manifest, so it cannot immediately receive the change. It may provisionally admit against that old copy. On sync, Laravel evaluates the current state and may reject the scan. Refresh manifests and sync queues before doors open and whenever local connectivity returns.

### API outage versus Wi-Fi outage

If only Laravel is unavailable, an already-open Expo app with a cached manifest can continue validating and queuing. If the phone loses all local Wi-Fi while running Expo Go, it may also lose the Metro JavaScript bundle. That is a development setup limitation; use an installed standalone app build to operate without Metro.

## Security boundaries and honest claims

- TOTP secrets, bearer tokens, passwords, and QR payloads are not presentation data and must not be logged or shared.
- A 30-second code is not an online lookup, and an offline green state is not final server approval.
- Stable `scan_id` values protect retries of the same captured scan. They do not make two separate offline captures globally atomic.
- Per-device duplicate prevention does not coordinate between disconnected devices.
- The offline manifest is gate-specific and sensitive, so it is encrypted locally and fetched only for staff assignments.
- The administrator dashboard currently cannot show real scanner heartbeat or pending-queue telemetry; the metrics endpoint reports that estimate as unavailable.
- A special marshal PIN override is not part of the current mobile flow. Do not promise override-based admission until that capability is designed, implemented, audited, and verified.

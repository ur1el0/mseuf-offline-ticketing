# MSEUF Offline Ticketing - Domain & Technical Glossary

This glossary defines the cryptographic, distributed systems, and architectural terminology used across the MSEUF Offline Ticketing project.

---

### Distributed MVC
An architectural pattern partitioning Model-View-Controller responsibilities across decoupled computing nodes. The centralized Laravel server acts as the Authoritative MVC (state of record, seed issuance, tie-breaking), while the mobile scanner operates as an autonomous Client Replica MVC (`expo-sqlite` as Model, `otpauth` as Controller, camera HUD as View).

### RFC 6238 (TOTP)
Time-Based One-Time Password algorithm. An open standard that generates short-lived, pseudo-random tokens using HMAC-SHA1 over a secret key and the current epoch timestamp divided by a time-step (30 seconds).

### Trust Anchor
The single source of truth for time in the verification process. In this system, the scanner device's hardware clock serves as the cryptographic trust anchor. The student device's clock is completely untrusted; manipulating it only produces tokens for invalid time windows.

### Clock Drift Window ($w$)
The allowable margin of error for time synchronization between student and scanner devices. A drift factor of $w = 1$ permits tokens generated in the previous, current, or next 30-second window ($\pm 30$ seconds), accommodating reasonable device clock variance while blocking stale tokens.

### Idempotency Key (`scan_id`)
A globally unique identifier (UUID v4) generated client-side by the mobile scanner at the exact instant of optical capture. Ensures that retried sync requests caused by dropped connections cannot generate duplicate admission entries or false collision flags.

### Split-Brain Collision
An anomaly where the same `ticket_id` is presented and claimed with two distinct `scan_id` values (e.g., at two different gates or scanners before either device has synced with the server). Both events are preserved in `audit_logs` for forensic review.

### Pessimistic Locking (`SELECT ... FOR UPDATE`)
A database concurrency control mechanism where a row is locked exclusively within an active transaction, forcing concurrent sync batches targeting the same ticket to queue sequentially and preventing double-spend race conditions.

### Supabase Session Pooler (Port 5432)
PostgreSQL connection pooling mode that allocates a persistent backend session per client connection. Unlike Transaction Poolers (Port 6543) which break transaction-scoped state, the Session Pooler fully supports PostgreSQL row-level pessimistic locks and advisory locks.

### Gate Partitioning
The practice of pre-assigning tickets to specific venue physical entrances (`gate_id`). Scanners only validate attendees assigned to their gate, restricting double-spending across disparate physical access points during offline periods.

### Marshal Override PIN
A cryptographically verified PIN entered by an authorized event marshal on the scanner device to force-admit an attendee during emergency crowd surges, bottlenecks, or gate reassignments. Emits an `OVERRIDE` audit event.

### Local Manifest (`local_manifest`)
A local SQLite table on the mobile scanner pre-populated before the event. Contains the assigned ticket IDs, student numbers, encrypted TOTP secrets, and local admission status.

### Pending Sync Queue (`pending_sync_queue`)
An offline store-and-forward SQLite table holding scanned ticket records (`scan_id`, `ticket_id`, `gate_id`, `scanned_at`, `is_override`) until opportunistic network reachability allows batch uploading to the authoritative server.

### Authoritative Server Tie-Breaker
The architectural invariant that server receive time (`server_received_at`) is the sole decisive timestamp for transaction ordering. Client timestamps (`device_scanned_at`) are treated strictly as unverified telemetry.

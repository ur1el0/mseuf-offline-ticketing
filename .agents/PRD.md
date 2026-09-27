# MSEUF Offline Ticketing - Product Requirements Document (PRD)

## 1. Project Overview
The **MSEUF Events Offline Ticketing System** is an offline-first cryptographic admissions management platform engineered for university events (e.g., University Foundation Week, concerts, sports tournaments) at Manuel S. Enverga University Foundation (MSEUF). 

The platform guarantees sub-second attendee admission verification at high-throughput gates, even in complete cellular connectivity blackouts, while preventing screenshot fraud, double-spending, and split-brain sync anomalies.

---

## 2. Target Audience & Roles

The system has exactly three end-user roles:

* **Students:** Use the student mobile app to display their securely stored, rotating digital tickets for venue entry.
* **Security Staff:** Use the offline mobile scanner app at venue doors to validate student tickets and manage physical access. A gate marshal is a Security Staff duty, not a separate user role; authorized staff may use the PIN override workflow.
* **Administrators:** Use the desktop web dashboard to set up events, manage gate assignments, and monitor system and audit logs.

---

## 3. Core Functional Requirements

### 3.1 Cryptographic Ticket Issuance & Dynamic QR (Student Mobile App)
- Authoritative server issues an AES-256 encrypted base32 TOTP secret per issued ticket.
- Student app securely caches the decrypted seed inside `expo-secure-store`.
- Entirely offline, the student app uses `otpauth` (RFC 6238) to generate a 6-digit TOTP payload updating every 30 seconds.
- The UI renders the dynamic payload as an SVG QR code (`react-native-qrcode-svg`) alongside a 30s visual countdown ring.
- Screenshots and static photos are invalidated within 30 seconds.

### 3.2 Offline Gate Scanner & Local Manifest (`expo-sqlite`)
- Scanners pre-load an encrypted `local_manifest` partition matching their assigned `gate_id`.
- Scans verify attendee TOTP tokens strictly against the scanner's hardware clock (which acts as the single cryptographic trust anchor). Attendee clock tampering cannot pass verification.
- Valid scans immediately update the local manifest status to `claimed` and enqueue a record into `pending_sync_queue`.

### 3.3 Gate Partitioning & Marshal Override PIN
- Tickets are restricted to specific entry gates to prevent physical double-spending.
- If a student arrives at the wrong gate, the scanner alerts `GATE_MISMATCH`.
- In crowd surges, severe bottlenecks, or official gate reassignments, a marshal can enter a secure master PIN to force-admit the attendee.
- Overrides are saved locally with `is_override = 1` and flagged on the server as `OVERRIDE` in `audit_logs`.

### 3.4 Idempotent Opportunistic Sync Pipeline
- Scanners mint a unique UUID v4 `scan_id` at the moment of optical detection.
- A network reachability heartbeat checks for server connectivity and uploads batches of 25–50 pending scans.
- If an HTTP connection drops after the server commits but before the client receives the ACK, the scanner retries safely. The server's `UNIQUE (scan_id)` constraint ensures idempotency without false split-brain alerts.
- In genuine multi-device double-scan scenarios (different `scan_id` for same `ticket_id`), the server detects the conflict via pessimistic locking and logs a `SPLIT_BRAIN_COLLISION` to `audit_logs`.

### 3.5 Administrator Web Dashboard & System Monitoring
- Administrators can set up events, manage gate assignments, and review system logs.
- Live metrics for Total Tickets, Admitted Count, Pending Syncs, Gate Throughput, and Flagged Collisions.
- HTTP polling (5–10s intervals) ensures zero WebSocket drops during presentations.
- Forensic audit log viewer displaying colliding timestamps, device IDs, and override events.

---

## 4. Non-Functional Requirements & Constraints

* **Strict Distributed MVC:** Model, View, and Controller responsibilities must remain completely decoupled across both backend (Laravel) and mobile (React Native Expo).
* **High Availability & Fault Tolerance:** Local gate scanning must operate with 0% network dependency once the initial manifest is cached.
* **Sub-Second Latency:** Local offline QR verification must complete in under 150 milliseconds per attendee.
* **Database Pooling Integrity:** Laravel must communicate via Supabase Session Pooler on Port 5432 to support PostgreSQL pessimistic locking (`selectForUpdate()`).

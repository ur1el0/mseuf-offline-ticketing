# MSEUF Offline Ticketing - System Architecture

## 1. High-Level Architecture: Distributed MVC

The MSEUF Events Offline Ticketing System operates as a **Distributed Model-View-Controller (MVC)** architecture. Instead of relying on a monolithic MVC or a constant live WebSocket connection, responsibilities are partitioned between an Authoritative Server MVC and an Offline Client Replica MVC.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AUTHORITATIVE SERVER MVC (Laravel)                            │
│  [Model: Eloquent + PostgreSQL]  <-->  [Controller: REST API]  <-->  [View: JSON / React] │
│   - Pessimistic Locking (5432)          - Sanctum Auth                 - Live Metrics   │
│   - Cryptographic Seed Issuance         - Sync Reconciliation          - HTTP Polling   │
│   - Authoritative Tie-Breakers          - Audit Logging                                 │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ Opportunistic Sync / Periodic Heartbeat
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT REPLICA MVC (React Native)                            │
│  [Model: expo-sqlite]            <-->  [Controller: TOTP / Sync] <--> [View: Vector QR / UI]│
│   - local_manifest                      - otpauth Engine (RFC 6238)    - react-native-   │
│   - pending_sync_queue (UUID v4)        - Marshal Override Logic         qrcode-svg     │
│   - expo-secure-store (Seeds)           - Scanner Clock Trust Anchor   - Scanner HUD    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architectural Layers & Responsibilities

### 2.1 Authoritative Server MVC (Laravel Backend)
* **Model Layer:**
  * Eloquent Models: `User`, `Ticket`, `ScanLog`, `AuditLog`.
  * Database: PostgreSQL hosted on Supabase.
  * Connection Pooler: Configured via the Supabase Session Pooler on **Port 5432** (not Transaction Pooler 6543) to support PostgreSQL row-level pessimistic locking (`SELECT ... FOR UPDATE`).
  * Cryptographic Security: TOTP seeds encrypted at rest using Laravel's AES-256-CBC cipher (`Crypt::encryptString`).
* **Controller Layer:**
  * Thin REST Controllers: `TicketSyncController`, `TicketIssuanceController`, `AuthController`, `AdminMetricsController`.
  * Controllers strictly validate incoming requests via dedicated FormRequests and delegate business logic to Domain Services (`SyncReconciliationService`, `TicketVerificationService`).
* **View Layer:**
  * API Layer: Standardized Eloquent API Resources (`TicketResource`, `ScanLogResource`, `AuditLogResource`).
  * Web Admin Dashboard: React SPA with TypeScript and Tailwind CSS, consuming API endpoints via deterministic HTTP interval polling (5s–10s cadence) to eliminate WebSocket delivery failure risk.

### 2.2 Client Replica MVC (React Native Expo Mobile Client)
* **Model Layer:**
  * SQLite Engine: `expo-sqlite` maintaining `local_manifest` (pre-event cached valid tickets) and `pending_sync_queue` (offline scan buffer).
  * Keystore: `expo-secure-store` storing student cryptographic seeds in hardware-backed encrypted storage.
* **Controller Layer:**
  * `totpController` / `useTotpTicket`: RFC 6238 TOTP computation using `otpauth` on a 30-second rotating window.
  * `scannerController` / `useTicketScanner`: Validates dynamic attendee QR tokens against `local_manifest` using the scanner's clock as the sole cryptographic trust anchor.
  * `syncController` / `useSyncQueue`: Opportunistic heartbeat that checks network connectivity and transmits un-synced batches in small compressed chunks.
  * `marshalOverrideController`: Handles PIN-authenticated supervisor override during crowd surges or gate reassignments.
* **View Layer:**
  * Student View: Clean SVG QR renderer (`react-native-qrcode-svg`) with dynamic 30-second expiration progress indicator.
  * Scanner View: Camera viewfinder HUD, real-time ticket admission status badges (Valid, Invalid, Expired, Wrong Gate, Override), and Marshal PIN prompt modal.

---

## 3. Database Schemas

### 3.1 PostgreSQL Authoritative Server Schema
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    student_number VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(32) DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gate_id INTEGER NOT NULL,
    totp_secret TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'issued',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scan_logs (
    id BIGSERIAL PRIMARY KEY,
    scan_id UUID UNIQUE NOT NULL,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    gate_id INTEGER NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    device_scanned_at TIMESTAMP WITH TIME ZONE NOT NULL,
    server_received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    gate_id INTEGER NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    anomaly_type VARCHAR(64) NOT NULL, -- 'SPLIT_BRAIN_COLLISION', 'OVERRIDE', 'GATE_MISMATCH'
    colliding_scan_id UUID,
    metadata JSONB,
    server_received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_gate_id ON tickets(gate_id);
CREATE INDEX idx_scan_logs_ticket_id ON scan_logs(ticket_id);
CREATE INDEX idx_scan_logs_scan_id ON scan_logs(scan_id);
CREATE INDEX idx_audit_logs_ticket_id ON audit_logs(ticket_id);
```

### 3.2 Mobile SQLite Client Replica Schema (`expo-sqlite`)
```sql
CREATE TABLE IF NOT EXISTS local_manifest (
    ticket_id INTEGER PRIMARY KEY,
    student_number TEXT NOT NULL,
    totp_secret TEXT NOT NULL,
    gate_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'unclaimed'
);

CREATE TABLE IF NOT EXISTS pending_sync_queue (
    scan_id TEXT PRIMARY KEY,
    ticket_id INTEGER NOT NULL,
    gate_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    scanned_at INTEGER NOT NULL,
    is_override BOOLEAN DEFAULT 0,
    synced BOOLEAN DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_manifest_student ON local_manifest(student_number);
CREATE INDEX IF NOT EXISTS idx_pending_synced ON pending_sync_queue(synced);
```

---

## 4. Concurrency, Synchronization & Tie-Breaking

1. **Idempotency Guarantee:** Mobile scanners mint a UUID v4 `scan_id` at the exact moment of optical capture. Network retries due to dropped TCP connections or HTTP timeouts are recognized idempotently by the server through the `UNIQUE (scan_id)` constraint without recording false split-brain alerts.
2. **Pessimistic Concurrency:** When processing an incoming sync chunk, the server wraps updates inside database transactions using `Ticket::where('id', $ticketId)->lockForUpdate()->first()`.
3. **Split-Brain Anomaly Handling:** If distinct `scan_id` values arrive for the same `ticket_id` from different physical gates or devices, the authoritative server marks both scans in `audit_logs` as `SPLIT_BRAIN_COLLISION` and keeps forensic logs.
4. **Authoritative Timestamp Tie-Breaker:** Client device clocks are treated as unverified. In any reconciliation conflict, the server's `server_received_at` timestamp is the sole authoritative tie-breaker.

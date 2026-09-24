# 04 - Mobile Scanner Replica Architecture (React Native Expo)

## 1. Overview
The Mobile Scanner application operates at physical venue entrances (e.g. Gate 1, Gate 2, Gymnasium). It operates as an autonomous Client Replica MVC: it verifies dynamic attendee TOTP QR tokens completely offline against a pre-loaded SQLite manifest and queues scans in an offline buffer for opportunistic background synchronization.

---

## 2. Technical Stack
* **Framework:** React Native with Expo (Managed Workflow, TypeScript).
* **Local Database:** `expo-sqlite` (chosen over native C++ SQLite bridges to avoid build compilation friction and runtime linking errors).
* **Camera Hardware Engine:** `expo-camera` with barcode scanner HUD callbacks.
* **Cryptographic Engine:** `otpauth` (RFC 6238 implementation with tolerance $w = 1$).

---

## 3. SQLite Client Schema & Table Lifecycles

### 3.1 `local_manifest`
Pre-populated prior to gate opening via `/api/v1/gates/{gate_id}/manifest`:
```sql
CREATE TABLE IF NOT EXISTS local_manifest (
    ticket_id INTEGER PRIMARY KEY,
    student_number TEXT NOT NULL,
    totp_secret TEXT NOT NULL,
    gate_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'unclaimed' -- 'unclaimed', 'claimed', 'revoked'
);
CREATE INDEX IF NOT EXISTS idx_manifest_student ON local_manifest(student_number);
```

### 3.2 `pending_sync_queue`
Local store-and-forward buffer populated at the moment of scan:
```sql
CREATE TABLE IF NOT EXISTS pending_sync_queue (
    scan_id TEXT PRIMARY KEY, -- Client-generated UUID v4
    ticket_id INTEGER NOT NULL,
    gate_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    scanned_at INTEGER NOT NULL, -- Epoch milliseconds
    is_override BOOLEAN DEFAULT 0,
    synced BOOLEAN DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pending_synced ON pending_sync_queue(synced);
```

---

## 4. Verification Workflow

```
[ Optical Capture of Barcode: MSEUF:{ticket_id}:{token} ]
                     │
                     ▼
[ Lookup ticket in SQLite local_manifest ]
   ├── Not Found ───────────────────────────────> Reject: INVALID_TICKET
   ├── Gate Mismatch & No Override ─────────────> Reject: GATE_MISMATCH
   ├── status == 'claimed' ─────────────────────> Reject: ALREADY_CLAIMED
   └── status == 'unclaimed' ───────────────────> Proceed to TOTP Check
                     │
                     ▼
[ Evaluate token with otpauth using Scanner Clock (Trust Anchor) ]
   ├── Token Expired / Invalid ─────────────────> Reject: TOKEN_EXPIRED
   └── Token Valid (within w = 1)
                     │
                     ▼
[ Atomic SQLite Transaction ]
   1. UPDATE local_manifest SET status = 'claimed' WHERE ticket_id = ?
   2. INSERT INTO pending_sync_queue (scan_id, ticket_id, ...) VALUES (UUIDv4(), ...)
   3. Trigger Audio/Visual Success Feedback on Scanner HUD
```

---

## 5. Marshal Override Mode
During high-pressure physical crowd surges or unexpected gate reassignments, an authorized supervisor enters a master PIN into the scanner interface. The controller force-admits the attendee, updates `local_manifest`, and enqueues a record with `is_override = 1`.

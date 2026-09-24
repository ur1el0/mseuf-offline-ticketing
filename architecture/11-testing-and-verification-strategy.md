# 11 - Testing & Quality Assurance Verification Strategy

## 1. Overview
The testing framework guarantees that cryptographic invariants, offline data persistence, and concurrent database synchronization remain regression-free. Testing is executed using a Test-Driven Development (TDD) protocol across both the Laravel backend (Pest / PHPUnit) and React Native mobile clients (Jest).

---

## 2. Test Execution Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Laravel Backend Test Suite                      │
│ - Ticket Issuance & Cryptographic Seed Encryption (Pest)              │
│ - Idempotent Batch Sync Submission (No Duplication on Retry)           │
│ - Concurrency & Pessimistic Locking under Simulated Race Conditions   │
│ - Split-Brain Collision Detection & Forensic Audit Recording           │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Mobile Client Test Suite                        │
│ - RFC 6238 TOTP Engine Calculations & Window Tolerance (Jest)         │
│ - SQLite Manifest Lookups & Sync Queue Enqueuing                       │
│ - Marshal Override PIN Validation & Status Mutation                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. High-Value Test Scenarios

### 3.1 Idempotency Verification
* **Test Case:** Submit the identical sync payload containing UUID `c71a3994-e38c-4a37-9759-4b6e594d4d14` twice consecutively.
* **Assertion:** Both requests return `200 OK`. The second request does not insert an additional row into `scan_logs` and does not generate a false `SPLIT_BRAIN_COLLISION` alert in `audit_logs`.

### 3.2 Split-Brain Collision Handling
* **Test Case:** Submit two sync payloads with distinct UUIDs (`UUID-A` and `UUID-B`) for the same `ticket_id`.
* **Assertion:** The first payload updates ticket status to `claimed` and writes to `scan_logs`. The second payload detects the already-claimed state, keeps the first scan authoritative, and creates an `audit_logs` record with `anomaly_type = 'SPLIT_BRAIN_COLLISION'`.

### 3.3 Dynamic QR 30-Second Boundary & Clock Skew
* **Test Case:** Generate a token at $T = 30$s. Verify against scanner at $T = 35$s (valid), $T = 59$s (valid within $w = 1$), and $T = 95$s (expired, rejected).

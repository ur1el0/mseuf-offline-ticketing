# MSEUF Offline Ticketing - Cryptographic & Data Security Policy

This document defines the mandatory cryptographic standards, offline security baselines, and data integrity protocols enforced across the MSEUF Offline Ticketing system.

---

## 1. Cryptographic Invariants & Dynamic QR (RFC 6238)

Static QR codes and screenshot sharing represent the primary vulnerability in traditional event ticketing. To eliminate this vector:

1. **RFC 6238 TOTP Algorithm:** Tickets use standard HMAC-based One-Time Passwords with a 30-second time-step ($T_0 = 0, T_X = 30$) and 6-digit output length.
2. **Library Standardization:** Mobile clients must use the battle-tested `otpauth` package to prevent manual JavaScript HMAC rounding or arithmetic errors.
3. **Seed Protection:**
   - **Server:** TOTP base32 secret keys are encrypted in PostgreSQL using Laravel's AES-256-CBC envelope (`Crypt::encryptString($secret)`).
   - **Student Mobile App:** Stored exclusively inside `expo-secure-store` (hardware-backed Keychain on iOS and KeyStore on Android).
   - **Scanner Local Manifest:** Pre-loaded secrets in `local_manifest` are strictly accessible only within the sandboxed SQLite instance.

---

## 2. Scanner Hardware Clock as Trust Anchor

1. **Zero-Trust Client Time:** Student device clocks are completely untrusted. Any student adjusting system time on their phone will simply generate a TOTP token corresponding to an invalid time slot.
2. **Trust Anchor:** The physical scanner device's clock serves as the sole cryptographic trust anchor. 
3. **Allowable Drift:** Scanners evaluate tokens within a tolerance window of $w = 1$ step (current 30s window $\pm 30$ seconds) to absorb minor clock variances while strictly rejecting stale tokens.

---

## 3. Idempotency & Replay Attack Defense

1. **Client-Generated UUID v4:** Scanners generate an RFC 4122 UUID v4 `scan_id` at the instant of optical scan.
2. **Database Constraint:** `scan_logs` enforces a PostgreSQL `UNIQUE (scan_id)` constraint.
3. **Dropped ACK Mitigation:** If an opportunistic sync HTTP request is acknowledged by the server but the connection drops before the client receives the 200 OK, the client will retry the same batch. The server detects the existing `scan_id` and acknowledges the record idempotently without logging a false collision.

---

## 4. Concurrency & Split-Brain Mitigation

1. **PostgreSQL Pessimistic Locking:** Incoming sync batches are processed inside database transactions. When evaluating a ticket, the reconciliation service locks the row:
   ```php
   $ticket = Ticket::where('id', $ticketId)->lockForUpdate()->first();
   ```
2. **Supabase Port 5432 Connection:** Laravel's database configuration MUST connect through the Supabase Session Pooler on **Port 5432** (not Transaction Pooler 6543) so that `SELECT ... FOR UPDATE` locks are honored without connection termination.
3. **Collision Auditing:** When two distinct `scan_id` records attempt to claim the same `ticket_id`, the second scan is isolated, and both records are logged in `audit_logs` under anomaly type `SPLIT_BRAIN_COLLISION` for forensic review.
4. **Authoritative Timestamp Tie-Breaker:** Server `server_received_at` timestamp is the sole authority for sequence resolution. Device `scanned_at` is treated strictly as informational telemetry.

---

## 5. Marshal Override Security

1. **Master PIN Protection:** The override PIN is never stored in plaintext. Mobile scanners compare hashed inputs against a salted environment configuration or supervisor hash.
2. **Mandatory Audit Logging:** Every override bypass creates an immutable record with `anomaly_type = 'OVERRIDE'`, capturing the marshal's device ID, gate ID, and timestamp.

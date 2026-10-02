# 08 - Cryptographic & Offline Synchronization Engine

## 1. Cryptographic Model: Dynamic TOTP Verification

Traditional event ticketing systems that present static QR codes are vulnerable to instantaneous screenshot theft via messaging apps. The MSEUF system enforces offline dynamic QR tokens via RFC 6238 TOTP:

$$C_0 = \left\lfloor \frac{T - T_0}{T_X} \right\rfloor$$

Where:
* $T$ is the scanner's current Unix epoch timestamp.
* $T_0 = 0$ (Unix epoch).
* $T_X = 30$ seconds (time-step interval).
* $\text{HMAC-SHA1}(K, C_0)$ generates a truncated 6-digit decimal token.

### Scanner Clock as Cryptographic Trust Anchor
Attendee smartphone clocks are untrusted. If an attendee deliberately rolls back their phone clock, the student app generates a token corresponding to a past window. When presented at the gate, the scanner evaluates the token against its own clock and immediately rejects the expired token.

---

## 2. Idempotency & Replay Defense (`scan_id`)

During network instability, HTTP acknowledgments are often dropped. 
* To prevent duplicate counts or false double-spending alarms, the mobile scanner assigns a UUID v4 `scan_id` at the moment of scan.
* If a network batch fails to receive a `200 OK`, the client retries the same `scan_id` and one-time QR proof.
* The server recognizes the existing `scan_id` via `UNIQUE (scan_id)` and returns its original decision without re-incrementing gate counts or creating false collision alerts.
* QR code/step values are checked against the ticket's decrypted secret during reconciliation and never written to scan logs. They are erased from the local queue after acknowledgment.

---

## 3. Opportunistic Sync

```
[ Local Scanner Engine ]
         │
         ▼
[ Scanner open / refresh / explicit sync action ]
         │
         ├── Offline ──────> Keep encrypting validated scans in the local queue
         │
         └── Reachable ────> Fetch up to 50 pending rows
                                 │
                                 ▼
                     [ POST /api/v1/sync/batch ]
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
              [ 200 OK ]              [ Network Drop ]
                     │                       │
       Store server decisions;       Keep encrypted rows pending;
       erase code proof locally      retry with the same scan IDs
```


## 4. Encrypted Client Replica Storage

The scanner's gate manifest and pending scan payloads are encrypted with AES-256-GCM before they are written to SQLite. The encryption key is stored separately in Expo SecureStore. SQLite contains ciphertext, queue IDs, keyed ticket fingerprints, and sync state, but not plaintext TOTP seeds or one-time QR codes. After a server acknowledgment, the local row keeps only its duplicate-prevention fingerprint and server decision; its encrypted payload is erased.

A database-only compromise exposes ciphertext, scan counts, and limited queue metadata. A compromise that also exposes the SecureStore key can reveal cached gate TOTP seeds and unsynchronized scan records. Local offline acceptance cannot learn about event cancellation or postponement until the device reconnects; the server returns an explicit rejection at reconciliation.

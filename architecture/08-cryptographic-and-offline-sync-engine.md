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
* If a network batch fails to receive a `200 OK`, the client retries the same `scan_id`.
* The server recognizes the existing `scan_id` via `UNIQUE (scan_id)` and returns a successful acknowledgment without re-incrementing gate counts or creating false collision alerts.

---

## 3. Opportunistic Heartbeat Sync Pipeline

```
[ Local Scanner Engine ]
         │
         ▼
[ Network Listener: NetInfo / Fetch Check ]
         │
         ├── Offline ──────> Sleep 15s; keep buffering scans in pending_sync_queue
         │
         └── Online ───────> Fetch 25–50 un-synced rows (synced == 0)
                                 │
                                 ▼
                     [ POST /api/v1/sync/batch ]
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
              [ 200 OK ]              [ Network Drop ]
                     │                       │
      UPDATE pending_sync_queue       Keep synced == 0;
      SET synced = 1 WHERE scan_id IN (?)   Retry next heartbeat cycle
```

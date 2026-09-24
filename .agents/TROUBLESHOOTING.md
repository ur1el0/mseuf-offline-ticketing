# MSEUF Offline Ticketing - Troubleshooting Runbook

This runbook documents common development and runtime exceptions, their root causes, and verified resolution procedures.

---

## 1. Database & Concurrency Issues

### 1.1 Supabase Connection Error: `Cannot execute SELECT FOR UPDATE in transaction pooling mode`
* **Root Cause:** Laravel is connected to Supabase using the Transaction Pooler (Port 6543) instead of the Session Pooler (Port 5432). Transaction poolers terminate connections when explicit row-level locks or transaction-scoped state is held.
* **Resolution:**
  1. Open `.env`.
  2. Verify `DB_PORT=5432` (and ensure your Supabase connection string specifies the Session Pooler).
  3. Clear Laravel config cache: `php artisan config:clear`.

### 1.2 Deadlocks during Concurrent Sync Bursts
* **Root Cause:** Multiple scanner sync batches are locking tickets in inconsistent order.
* **Resolution:** In `SyncReconciliationService`, always sort incoming ticket IDs ascending (`sort($ticketIds)`) before acquiring pessimistic locks (`lockForUpdate()`) to prevent circular wait deadlocks.

---

## 2. Cryptographic & TOTP Issues

### 2.1 Legitimate Student QR Token Rejected as `EXPIRED`
* **Root Cause:** Hardware clock drift on the student device or scanner device exceeds the allowed window.
* **Resolution:**
  1. Inspect the scanner hardware time against standard NTP (`pool.ntp.org`). The scanner clock is the cryptographic trust anchor.
  2. In `services/totpService.ts`, verify window parameter is set to $w = 1$ (`window: 1`). This allows tokens within $\pm 30$ seconds.

### 2.2 Base32 Secret Encoding / Decoding Mismatch
* **Root Cause:** Inconsistent padding or lowercase/uppercase character representation between Laravel `Crypt` and `otpauth`.
* **Resolution:** Ensure the base32 secret is normalized to uppercase and stripped of whitespace before passing into `new OTPAuth.TOTP({ secret: ... })`.

---

## 3. Offline Sync & Mobile Issues

### 3.1 Network Request Failed on Android Device
* **Root Cause:** Android security prevents connecting to unencrypted HTTP on `localhost` or `127.0.0.1` from mobile apps.
* **Resolution:**
  1. When using a physical device connected via USB, run:
     ```bash
     adb reverse tcp:8000 tcp:8000
     ```
  2. Configure `mobile/src/config/api.ts` to use `http://10.0.2.2:8000` (for Android emulator) or `http://localhost:8000` (with adb reverse on physical device).

### 3.2 False `SPLIT_BRAIN_COLLISION` Alert on Network Retries
* **Root Cause:** Scanner generates a new `scan_id` on every HTTP retry instead of preserving the original UUID v4 created at the moment of scan.
* **Resolution:** In `pending_sync_queue`, the `scan_id` must be generated once upon optical detection and stored permanently in SQLite. Retries must read the existing `scan_id` from SQLite and transmit it unchanged.

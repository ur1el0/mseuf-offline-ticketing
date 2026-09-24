---
trigger: always_on
---

# Rule 06: Offline TOTP & Idempotent Sync Standards

These standards govern the offline cryptographic validation and synchronization mechanics.

### 1. Dynamic TOTP Generation (RFC 6238)
* **Rule:** Static QR codes and screenshots are strictly rejected.
* **Practice:**
  * Calculate a new 6-digit TOTP token every 30 seconds using `otpauth`.
  * Render dynamically via `react-native-qrcode-svg`.
  * The QR payload must combine the student ticket identifier with the active TOTP token:
    `MSEUF:{ticket_id}:{totp_token}`.

### 2. Scanner Hardware Clock as Trust Anchor
* **Rule:** The student device's clock is completely untrusted.
* **Practice:** Scanners evaluate incoming tokens against the scanner's internal clock. Set token tolerance to $w = 1$ ($\pm 30$ seconds).

### 3. Idempotent Syncing via UUID v4 `scan_id`
* **Rule:** Every scan transaction must have an immutable, client-minted UUID v4.
* **Practice:**
  * Generate `scan_id` upon optical capture and persist immediately into `pending_sync_queue`.
  * Network retries must resend the original `scan_id` to prevent duplicate counts or false split-brain collisions.

### 4. Chunked Heartbeat Sync
* **Rule:** Never attempt an uncompressed bulk dump after an event.
* **Practice:** Implement an opportunistic heartbeat checking network reachability every 15–30 seconds. Transmit un-synced rows (`synced = 0`) in small chunks (25–50 records) and update local `synced = 1` flags only upon receiving an HTTP 200 OK response.

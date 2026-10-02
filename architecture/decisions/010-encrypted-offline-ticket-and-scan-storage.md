# ADR 010: Encrypt Offline Ticket and Scan Payloads Before SQLite Persistence

- Status: Accepted
- Date: 2026-10-02

## Context

The existing design requires the student app to retain its ticket secret securely and the security scanner to work without a network connection. The scanner must also retain a downloaded gate manifest and validated scans until sync. A SecureStore-only design cannot efficiently hold large event manifests or scan queues; plaintext TOTP data in SQLite would violate the credential protection requirement.

## Options considered

1. Store full manifests and scan queues as SecureStore entries. This is unsuitable for growing event data and native key-value size limits.
2. Store manifest and scan records in SQLite as plaintext and keep only the key material in SecureStore. This exposes TOTP seeds and one-time proofs in a database-only compromise.
3. Encrypt each local payload before SQLite persistence, while keeping the AES key in SecureStore. This permits indexed, durable local storage without writing ticket secrets or scan proofs as plaintext.

## Decision

- Store the student's individual ticket snapshot, including its TOTP secret, in Expo SecureStore.
- Encrypt the complete scanner gate manifest and each pending scan payload with AES-256-GCM before storing it in SQLite.
- Keep each AES key in Expo SecureStore, separate from the SQLite database.
- Use a SecureStore-only random salt when generating ticket fingerprints used for on-device duplicate detection.
- After server acknowledgment, erase the queued scan payload and retain only a salted fingerprint, scan ID, sync state, and server decision so the same device can still block local replay.
- Send the scanned QR step/code to Laravel only in the sync request. Laravel verifies the HMAC, never stores the one-time code, and returns an outcome for each idempotency key.

## Consequences

- The database stores no plaintext TOTP seeds, one-time codes, or ticket IDs in the scanner queue payload.
- A database-only copy reveals ciphertext and limited operational metadata. A compromise of both the database and SecureStore key material can expose offline secrets and unsynchronized records.
- SecureStore is designed for small key-value secrets and should not store whole manifests or growing queues; the app uses SQLite for ciphertext and SecureStore only for keys and the student's small ticket snapshots.
- Offline scans remain provisional until reconciliation. A scanner cannot learn about a cancellation or postponement while disconnected; Laravel rejects the queued scans when it receives them.
- This decision resolves ADR 009's earlier TOTP storage question without changing the server-side encrypted `tickets.totp_secret` column.

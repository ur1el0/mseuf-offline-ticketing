---
trigger: always_on
---

# Rule 04: Testing & Quality Assurance Standards

These standards enforce the Test-Driven Development (TDD) protocol across the platform.

### 1. Laravel Backend Testing (Pest / PHPUnit)
* **Rule:** Every new endpoint, service, or migration must have accompanying automated tests.
* **Coverage Requirements:**
  1. **Seed & Issuance:** Test that ticket issuance generates encrypted base32 seeds and valid user associations.
  2. **Idempotency:** Submit the same sync payload with identical `scan_id` twice. Test that second request returns 200 OK without adding records or creating audit logs.
  3. **Split-Brain Collision:** Submit two sync payloads with distinct `scan_id` values for the same `ticket_id`. Test that the second payload generates an audit record with `anomaly_type = 'SPLIT_BRAIN_COLLISION'`.
  4. **Pessimistic Concurrency:** Test concurrent sync batch processing within database transactions.

### 2. Mobile Client Testing (Jest)
* **Rule:** Mobile business logic controllers must have unit tests independent of native UI rendering.
* **Coverage Requirements:**
  1. **TOTP Engine:** Verify RFC 6238 token generation across current window, boundary transitions (+30s), and tolerance window ($w = 1$).
  2. **SQLite Queue:** Verify enqueueing, pending status retrieval, marking synced, and retry logic.
  3. **Marshal PIN:** Verify valid PIN allows override status (`is_override = 1`) and invalid PIN blocks admission.

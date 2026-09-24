# MSEUF Offline Ticketing - Master Task Backlog

This backlog enumerates granular engineering tasks across all development phases.

---

## 1. Backend API & Cryptography (Laravel)
- [ ] Configure `config/database.php` for Supabase Session Pooler (port 5432) with persistent connections.
- [ ] Create migration for `users` table with `student_number` unique index.
- [ ] Create migration for `tickets` table with `totp_secret` (encrypted text), `gate_id`, `status`.
- [ ] Create migration for `scan_logs` table with `scan_id` (UUID unique) and foreign key to `tickets`.
- [ ] Create migration for `audit_logs` table with `anomaly_type`, `colliding_scan_id`, and `metadata` (JSONB).
- [ ] Implement `TotpSeedGeneratorService` using RFC 6238 compatible base32 secret generation.
- [ ] Implement `TicketIssuanceService` to associate students with events, assign gates, and encrypt seeds.
- [ ] Build `ManifestDownloadController` to provide initial manifest partition to scanners.
- [ ] Implement `TicketSyncController` with batch ingestion FormRequest validation.
- [ ] Implement `SyncReconciliationService` with `SELECT ... FOR UPDATE` row locks on `tickets`.
- [ ] Build idempotent deduplication logic for retried `scan_id` values.
- [ ] Write Pest/PHPUnit tests for ticket issuance, valid TOTP verification, idempotent retries, and collision logging.

---

## 2. Web Admin Dashboard (React + TypeScript)
- [ ] Set up React Vite application with Tailwind CSS and Lucide icons.
- [ ] Build `useAdminMetrics` hook using HTTP interval polling (5s frequency).
- [ ] Implement Gate Throughput visual cards with progress bars (Admitted vs. Remaining).
- [ ] Implement Live Anomaly & Collision Alert Feed displaying device IDs and colliding timestamps.
- [ ] Implement Marshal Override Log table with forensic event inspector.
- [ ] Implement Ticket Search & Revocation modal.
- [ ] Write component tests verifying polling updates and alert rendering.

---

## 3. Mobile Scanner App (React Native Expo)
- [ ] Configure Expo project with TypeScript, `expo-sqlite`, and `expo-camera`.
- [ ] Implement `databaseService.ts` to manage `local_manifest` and `pending_sync_queue`.
- [ ] Build pre-event manifest synchronization flow to populate SQLite database.
- [ ] Implement `useTicketScanner` hook validating QR payloads against SQLite manifest using `otpauth`.
- [ ] Build Scanner HUD camera screen with real-time bounding box and status banner.
- [ ] Implement Marshal Override PIN modal with supervisor authorization logic.
- [ ] Implement `syncWorker.ts` with network reachability listener and chunked batch upload.
- [ ] Write Jest tests for SQLite manifest lookups, sync queue transitions, and PIN validation.

---

## 4. Student Dynamic Ticket App (React Native Expo)
- [ ] Build Student Login and Event Ticket Wallet screen.
- [ ] Implement `secureStorageService.ts` using `expo-secure-store` for seed persistence.
- [ ] Implement `useTotpTicket` hook calculating 6-digit TOTP token every 30 seconds via `otpauth`.
- [ ] Integrate `react-native-qrcode-svg` to dynamically render vector QR codes.
- [ ] Implement 30-second circular countdown timer synchronized with TOTP time-step.
- [ ] Add anti-screenshot watermark overlay with attendee metadata.
- [ ] Write Jest tests for dynamic TOTP generation across step boundaries.

---

## 5. Verification & Defense Readiness
- [ ] Multi-scanner concurrency stress test script simulating simultaneous gate syncs.
- [ ] Proof of clock tampering defense: Test student app with skewed system clock.
- [ ] Verify Supabase PostgreSQL pessimistic locking behavior under high sync load.
- [ ] Conduct comprehensive line-by-line code and logic walkthrough.

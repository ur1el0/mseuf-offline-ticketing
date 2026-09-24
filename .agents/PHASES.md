# MSEUF Offline Ticketing - Engineering Phases & Milestones

This document outlines the sequential phases of development, tracking progress from foundational backend services to offline mobile deployment and defense preparation.

---

## Phase 1: Authoritative Server MVC Foundation & Cryptography
* [ ] Initialize Laravel REST API with PostgreSQL connection via Supabase Session Pooler (Port 5432).
* [ ] Database migrations: `users`, `tickets`, `scan_logs`, `audit_logs` with all indexes and constraints.
* [ ] User authentication with Laravel Sanctum (Student & Admin roles).
* [ ] Cryptographic Seed Service: AES-256 base32 TOTP secret generation, encryption, and issuance.
* [ ] Eloquent Models with relationships, scopes, and encrypted cast attributes.
* [ ] Seeders for MSEUF sample events, gates (Gate 1, Gate 2, Gym), students, and tickets.
* [ ] Automated backend unit tests (Pest / PHPUnit) for ticket issuance and encryption.

---

## Phase 2: Sync Ingestion, Concurrency & Reconciliation Engine
* [ ] Idempotent `TicketSyncController` handling opportunistic batch payloads.
* [ ] FormRequest validation for sync batches and client UUID v4 `scan_id`.
* [ ] `SyncReconciliationService` implementing PostgreSQL row-level pessimistic locking (`lockForUpdate()`).
* [ ] Deduplication logic: Recognize repeated `scan_id` without creating false collisions.
* [ ] Forensic anomaly logger: Record `SPLIT_BRAIN_COLLISION`, `OVERRIDE`, and `GATE_MISMATCH` events in `audit_logs`.
* [ ] Authoritative timestamp tie-breaker logic using `server_received_at`.
* [ ] Integration tests simulating concurrent sync batches and split-brain conflicts.

---

## Phase 3: Web Admin Dashboard (Risk-Free Delivery)
* [ ] React + TypeScript SPA setup using Tailwind CSS.
* [ ] HTTP Polling service (5s–10s intervals) targeting `/api/v1/admin/metrics` (no WebSockets).
* [ ] Gate Throughput & Status Cards (Admitted vs. Remaining per gate).
* [ ] Anomaly & Collision Alert Feed with live forensic details.
* [ ] Marshal Override Audit Log table with device and timestamp telemetry.
* [ ] Ticket Search & Manual Invalidation view.

---

## Phase 4: Mobile Scanner Replica MVC (React Native Expo)
* [ ] Expo TypeScript initialization with `expo-sqlite` and `expo-camera`.
* [ ] SQLite schema migrations: `local_manifest` and `pending_sync_queue`.
* [ ] `ScannerController` / `useTicketScanner` hook validating attendee TOTP tokens against local manifest using the device clock as the trust anchor.
* [ ] Marshal Override PIN flow modal for surge force-admission (`is_override = 1`).
* [ ] Opportunistic reachability heartbeat: Detect connection and upload compressed batches (25–50 records) from `pending_sync_queue`.
* [ ] Scanner HUD: Real-time visual feedback badges (Admitted, Invalid, Expired, Wrong Gate, Override).

---

## Phase 5: Student Dynamic QR Client (React Native Expo)
* [ ] Student ticket wallet view with secure login and manifest caching.
* [ ] Cryptographic seed retrieval and persistence in `expo-secure-store`.
* [ ] `TotpController` / `useTotpTicket` hook generating RFC 6238 6-digit tokens every 30 seconds using `otpauth`.
* [ ] Dynamic vector QR rendering with `react-native-qrcode-svg`.
* [ ] 30-second countdown indicator and automatic payload refresh.
* [ ] Anti-screenshot visual watermark and brightness helper.

---

## Phase 6: End-to-End Stress Simulation & Midterm Defense Preparation
* [ ] Concurrent sync simulation: Simulate 3 scanners uploading overlapping batches simultaneously.
* [ ] Offline-to-online transition test: Scan 100 tickets completely offline, then restore network.
* [ ] Clock tampering resilience test: Demonstrate student phone time manipulation fails verification.
* [ ] Exhaustive line-by-line masterclass walkthrough of all backend, mobile, and web modules.
* [ ] Oral defense preparation covering Distributed MVC purity, cryptographic invariants, and database locks.

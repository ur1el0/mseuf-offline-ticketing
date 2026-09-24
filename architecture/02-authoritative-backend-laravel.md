# 02 - Authoritative Backend Architecture (Laravel REST API)

## 1. Overview
The backend application is built using PHP Laravel, functioning as the centralized state authority. It issues cryptographic seeds, authenticates users, receives opportunistic scan sync batches, enforces row-level concurrency locking, and resolves synchronization conflicts.

---

## 2. Layered Architecture & Separation of Concerns

```
[ HTTP Request ]
       │
       ▼
[ FormRequest Validation ]   ---> Returns 422 Unprocessable Content on malformed input
       │
       ▼
[ Controller Layer ]         ---> Thin Orchestrator (<150 lines); zero raw SQL
       │
       ▼
[ Domain Service Layer ]     ---> Business rules: SyncReconciliationService, TicketService
       │
       ▼
[ Eloquent Repository Layer] ---> PostgreSQL queries with pessimistic locking
       │
       ▼
[ Eloquent API Resource ]    ---> Formatted, sanitized JSON output (TicketResource, etc.)
```

---

## 3. Core Domain Services

### 3.1 `SyncReconciliationService`
Responsible for processing chunked opportunistic batches uploaded by mobile scanners.
* Wraps batch processing in explicit database transactions (`DB::transaction()`).
* Acquires PostgreSQL row-level locks via `lockForUpdate()` on target tickets.
* Sorts ticket IDs ascending prior to locking to prevent circular deadlock conditions.
* Evaluates idempotency keys:
  * If incoming `scan_id` already exists in `scan_logs`, acknowledge with `200 OK` (idempotent duplicate).
  * If ticket is already marked `claimed` with a *different* `scan_id`, flags `SPLIT_BRAIN_COLLISION` and writes forensic evidence to `audit_logs`.
* Applies authoritative server timestamp (`server_received_at = now()`) for deterministic ordering.

### 3.2 `TicketIssuanceService`
Handles attendee ticket provisioning:
* Generates a 160-bit (32-character) RFC 3548 Base32 cryptographic secret key.
* Encrypts the raw secret using Laravel's AES-256-CBC envelope (`Crypt::encryptString`) before persisting to `tickets.totp_secret`.
* Associates the ticket with the student user and assigns a designated physical entrance (`gate_id`).

---

## 4. Authentication & Authorization (Laravel Sanctum)

* **Tokens:** Bearer token authentication via Laravel Sanctum for both mobile clients and web admin users.
* **Role Segregation:**
  * `student`: Allowed to read personal issued tickets and retrieve assigned encrypted seeds.
  * `scanner`: Allowed to download gate manifest partitions and post sync batches to `/api/v1/sync/batch`.
  * `admin`: Allowed full access to issuance, live monitoring metrics, and forensic audit logs.

---

## 5. PostgreSQL Supabase Session Pooler Configuration

To support pessimistic row-level locking (`SELECT ... FOR UPDATE`), Laravel connects directly through the Supabase **Session Pooler on Port 5432**:
```php
// config/database.php
'pgsql' => [
    'driver' => 'pgsql',
    'host' => env('DB_HOST'),
    'port' => env('DB_PORT', '5432'), // Port 5432 Session Pooler (NOT 6543 Transaction Pooler)
    'database' => env('DB_DATABASE'),
    'username' => env('DB_USERNAME'),
    'password' => env('DB_PASSWORD'),
    'charset' => 'utf8',
    'prefix' => '',
    'schema' => 'public',
    'sslmode' => 'prefer',
],
```

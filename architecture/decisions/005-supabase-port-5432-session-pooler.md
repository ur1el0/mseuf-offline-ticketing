# ADR 005: Supabase Session Pooler (Port 5432) for Pessimistic Locking

## Status
Accepted

## Context
Supabase offers two pooling modes: the Transaction Pooler (Port 6543) and the Session Pooler (Port 5432). The Transaction Pooler terminates client connections when explicit row-level locks or transaction-scoped states are held, making `SELECT ... FOR UPDATE` operations fail with fatal exceptions.

## Decision
We mandate connecting to Supabase PostgreSQL exclusively via the **Session Pooler on Port 5432**:
1. All database configuration files (`config/database.php`) set `DB_PORT=5432`.
2. Laravel's `SyncReconciliationService` can safely acquire row-level locks via `lockForUpdate()` during batch processing.
3. Multiple concurrent sync uploads queue safely without race condition failures.

## Consequences
- **Positive:** Enables robust row-level pessimistic concurrency control; prevents double-spending during burst uploads.
- **Negative:** Session poolers maintain persistent backend server connections, requiring mindful pool size management.

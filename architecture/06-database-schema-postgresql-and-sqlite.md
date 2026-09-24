# 06 - Database Schemas: Authoritative PostgreSQL & Local SQLite

## 1. Authoritative Server Schema (PostgreSQL)

```sql
-- Users / Students
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    student_number VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(32) DEFAULT 'student', -- 'student', 'scanner', 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Event Tickets Table
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gate_id INTEGER NOT NULL,
    totp_secret TEXT NOT NULL, -- Encrypted via Laravel Crypt (AES-256)
    status VARCHAR(32) NOT NULL DEFAULT 'issued', -- 'issued', 'claimed', 'revoked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scan Logs (Enforcing Global Idempotency)
CREATE TABLE scan_logs (
    id BIGSERIAL PRIMARY KEY,
    scan_id UUID UNIQUE NOT NULL, -- Client-generated UUID v4
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    gate_id INTEGER NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    device_scanned_at TIMESTAMP WITH TIME ZONE NOT NULL,
    server_received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Forensic Audit Logs (Collisions & Overrides)
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    gate_id INTEGER NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    anomaly_type VARCHAR(64) NOT NULL, -- 'SPLIT_BRAIN_COLLISION', 'OVERRIDE', 'GATE_MISMATCH'
    colliding_scan_id UUID,
    metadata JSONB,
    server_received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Concurrency and Lookup Indexes
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_gate_id ON tickets(gate_id);
CREATE INDEX idx_scan_logs_ticket_id ON scan_logs(ticket_id);
CREATE INDEX idx_scan_logs_scan_id ON scan_logs(scan_id);
CREATE INDEX idx_audit_logs_ticket_id ON audit_logs(ticket_id);
```

---

## 2. Mobile Scanner Replica Schema (`expo-sqlite`)

```sql
-- Local Manifest: Partition pre-cached prior to event
CREATE TABLE IF NOT EXISTS local_manifest (
    ticket_id INTEGER PRIMARY KEY,
    student_number TEXT NOT NULL,
    totp_secret TEXT NOT NULL,
    gate_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'unclaimed' -- 'unclaimed', 'claimed', 'revoked'
);

-- Pending Sync Queue: Store-and-forward offline buffer
CREATE TABLE IF NOT EXISTS pending_sync_queue (
    scan_id TEXT PRIMARY KEY, -- Client-generated UUID v4
    ticket_id INTEGER NOT NULL,
    gate_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    scanned_at INTEGER NOT NULL, -- Epoch milliseconds
    is_override BOOLEAN DEFAULT 0,
    synced BOOLEAN DEFAULT 0
);

-- Local Performance Indexes
CREATE INDEX IF NOT EXISTS idx_manifest_student ON local_manifest(student_number);
CREATE INDEX IF NOT EXISTS idx_pending_synced ON pending_sync_queue(synced);
```

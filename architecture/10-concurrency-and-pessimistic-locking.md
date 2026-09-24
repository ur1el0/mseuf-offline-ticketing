# 10 - Concurrency & Pessimistic Locking Architecture

## 1. Overview
When multiple mobile scanners regain network reachability simultaneously, they transmit overlapping batches of scan logs. Without database-level concurrency controls, race conditions can cause double-spending and corrupted inventory states. This document details the concurrency model, Supabase connection pooler requirements, and row-level locking strategy.

---

## 2. Supabase Connection Pooler: Session vs. Transaction Mode

Supabase provides two distinct connection pooling endpoints for PostgreSQL:

| Dimension | Transaction Pooler (Port 6543) | Session Pooler (Port 5432) |
|---|---|---|
| **Primary Use Case** | Stateless serverless functions (AWS Lambda). | Long-running applications, database migrations, stateful transactions. |
| **Pessimistic Locking Support** | **BROKEN / UNSUPPORTED.** Terminates connection on `SELECT ... FOR UPDATE`. | **FULLY SUPPORTED.** Honors row-level locks across the entire transaction lifecycle. |
| **System Requirement** | **FORBIDDEN** for MSEUF sync reconciliation. | **MANDATORY** for MSEUF authoritative server. |

---

## 3. Concurrency Locking Protocol

```php
// In SyncReconciliationService:
DB::transaction(function () use ($batch, &$acknowledgedIds) {
    // 1. Sort ticket IDs ascending to eliminate circular deadlock risk
    $ticketIds = collect($batch['scans'])->pluck('ticket_id')->sort()->values()->all();

    // 2. Acquire exclusive pessimistic row locks
    $lockedTickets = Ticket::whereIn('id', $ticketIds)
        ->lockForUpdate()
        ->get()
        ->keyBy('id');

    foreach ($batch['scans'] as $scan) {
        $ticket = $lockedTickets->get($scan['ticket_id']);

        // 3. Idempotency Check: Existing scan_id acknowledged without error
        if (ScanLog::where('scan_id', $scan['scan_id'])->exists()) {
            $acknowledgedIds[] = $scan['scan_id'];
            continue;
        }

        // 4. Split-Brain Collision Detection
        if ($ticket->status === 'claimed') {
            AuditLog::create([
                'ticket_id' => $ticket->id,
                'gate_id' => $scan['gate_id'],
                'device_id' => $batch['device_id'],
                'anomaly_type' => 'SPLIT_BRAIN_COLLISION',
                'colliding_scan_id' => $scan['scan_id'],
                'server_received_at' => now(),
            ]);
            $acknowledgedIds[] = $scan['scan_id'];
            continue;
        }

        // 5. Normal Claim Execution
        $ticket->status = 'claimed';
        $ticket->save();

        ScanLog::create([
            'scan_id' => $scan['scan_id'],
            'ticket_id' => $ticket->id,
            'gate_id' => $scan['gate_id'],
            'device_id' => $batch['device_id'],
            'device_scanned_at' => Carbon::createFromTimestampMs($scan['scanned_at']),
            'server_received_at' => now(),
        ]);

        $acknowledgedIds[] = $scan['scan_id'];
    }
});
```

---

## 4. Authoritative Tie-Breaking
Client device system clocks are unverified and untrusted. If two mobile scanners scan the same ticket offline at different times, the server ignores device timestamps for state determination. Whichever scan batch acquires the row lock first on the authoritative server wins admission; the subsequent scan is logged as a collision.

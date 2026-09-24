# 09 - Gate Partitioning & Marshal Override Architecture

## 1. Overview
In a multi-gate offline university environment, attendees attempting to enter through unassigned gates or physical crowd bottlenecks present severe operational risks. This document specifies the gate segregation logic, cross-gate rejection rules, and the Marshal Override PIN fail-safe.

---

## 2. Gate Partitioning Model

```
                       [ Venue Access Boundaries ]
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
      [ Gate 1 ]               [ Gate 2 ]               [ Gate 3 ]
   (Main Entrance)          (Gymnasium Gate)         (Sports Complex)
          │                        │                        │
  local_manifest           local_manifest           local_manifest
  WHERE gate_id = 1        WHERE gate_id = 2        WHERE gate_id = 3
```

1. **Pre-Assignment:** Tickets are bound to an integer `gate_id` upon issuance based on ticket category, venue section, or student department.
2. **Scanner Partitioning:** Mobile scanners download only the manifest rows matching their assigned `gate_id`.
3. **Cross-Gate Defense:** If a student ticket assigned to Gate 1 is presented at Gate 2:
   - If Gate 2 does not have the ticket in `local_manifest`, scanner flags `UNKNOWN_TICKET`.
   - If a multi-gate manifest is deployed and ticket has `gate_id != scanner.gate_id`, scanner displays high-contrast yellow badge: `GATE_MISMATCH`.

---

## 3. Marshal Override PIN Workflow

During emergency situations (e.g. sudden rainstorm, physical gate bottleneck, electrical failure at Gate 1 requiring redirection of crowds to Gate 2), authorized gate marshals can force-admit attendees.

```
[ Scanner Screen: Gate Mismatch or Unclaimed Verification ]
                            │
                            ▼
               [ Tap "Marshal Override" ]
                            │
                            ▼
              [ Enter 6-Digit Master PIN ]
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        [ Invalid PIN ]             [ Valid PIN ]
              │                           │
       Block Admission;           1. UPDATE local_manifest
       Log Failed Attempt            SET status = 'claimed'
                                  2. INSERT INTO pending_sync_queue
                                     (is_override = 1, status = 'OVERRIDE')
                                  3. Play Authorized Override Audio Tone
                                  4. Emit High-Contrast Amber HUD Feedback
```

---

## 4. Forensic Telemetry & Server Audit Recording
When an override scan syncs to the authoritative Laravel server:
1. `SyncReconciliationService` detects `is_override == true`.
2. Creates an immutable record in `audit_logs`:
   - `anomaly_type`: `'OVERRIDE'`
   - `ticket_id`: Target ticket ID
   - `gate_id`: Scanner's current physical gate
   - `device_id`: Device identifier of the scanning marshal
   - `server_received_at`: Server timestamp
3. Displays instantly on the Web Admin Dashboard's Override Feed for administrative accountability.

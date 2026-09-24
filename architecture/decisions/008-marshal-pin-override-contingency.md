# ADR 008: Marshal Override PIN Flow for Venue Contingencies

## Status
Accepted

## Context
Physical events at MSEUF stadiums or gymnasiums frequently experience physical bottlenecks, crowd surges, gate hardware failures, or gate reassignments. If ticket validation is completely immutable and non-overridable, gate marshals cannot admit valid attendees when an assigned gate is blocked, causing safety hazards and crowd discontent.

## Decision
We implement a secure **Marshal Override PIN workflow**:
1. Gate marshals can trigger an override modal upon receiving a `GATE_MISMATCH` or unverified ticket.
2. The marshal enters a 6-digit master PIN.
3. Upon valid PIN entry, the attendee is admitted locally (`is_override = 1`).
4. When synced to the authoritative server, the entry is explicitly logged in `audit_logs` as anomaly type `'OVERRIDE'`.

## Consequences
- **Positive:** Resolves crowd safety and gate bottleneck emergencies in real-world university events while preserving complete forensic accountability.
- **Negative:** Requires supervisor PIN protection to prevent abuse by unauthorized staff.

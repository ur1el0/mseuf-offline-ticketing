# ADR 004: Client-Generated UUID v4 Idempotency Keys

## Status
Accepted

## Context
In campus environments with fluctuating cellular connectivity, mobile scanners transmitting opportunistic sync batches frequently suffer dropped TCP connections after the server processes the payload but before the client receives the HTTP `200 OK` acknowledgment. If the scanner retries the batch, naive server implementations can mistake the duplicate transmission for a double-spend attempt, generating false `SPLIT_BRAIN_COLLISION` security alerts.

## Decision
We enforce **client-generated UUID v4 idempotency keys (`scan_id`)**:
1. At the instant of optical scan, the mobile scanner generates an immutable UUID v4 `scan_id` and records it into `pending_sync_queue`.
2. The server schema enforces a `UNIQUE (scan_id)` constraint on `scan_logs`.
3. When processing sync batches, if the server encounters an existing `scan_id`, it acknowledges the record with `200 OK` without creating duplicate logs or collision alerts.
4. Genuine collisions occur only when the *same* `ticket_id` arrives with a *different* `scan_id`.

## Consequences
- **Positive:** Guarantees network retry idempotency; eliminates false split-brain alerts during dropped connections.
- **Negative:** Requires persisting the UUID client-side prior to network dispatch.

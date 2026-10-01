# EUEvent API Guide

This document records the API conventions for this project and marks which routes exist today. The detailed payload examples are in [`architecture/07-api-endpoint-contracts.md`](../architecture/07-api-endpoint-contracts.md); the route definitions are in [`backend/routes/api.php`](../backend/routes/api.php). The supplied Ingress API is not this project's endpoint contract.

## Base path and authentication

- API routes use `/api/v1`.
- JSON clients send `Accept: application/json`; JSON request bodies also send `Content-Type: application/json`.
- Protected routes use Laravel Sanctum bearer tokens and enforce roles and, where relevant, event/gate assignment on the server.
- The end-user roles are `student`, `security_staff`, and `administrator`.
- Current login uses `{ "identifier": "...", "password": "..." }`. Students use their student number; security staff and administrators use their institutional email. `device_name` is optional. Do not silently replace `identifier` with the different `email` field used by the supplied reference.
- Current login throttling is `throttle:6,1` on the route. The reference document's five-attempt policy is not active here.

## Implemented route inventory

| Method and path | Access | Implemented behavior |
| --- | --- | --- |
| `POST /api/v1/auth/login` | Public, throttled | Issues a Sanctum token and returns the user identity and role. |
| `POST /api/v1/auth/logout` | Authenticated | Revokes the current token. |
| `GET /api/v1/auth/me` | Authenticated | Returns the current user identity and role. |
| `GET /api/v1/gates/{gateId}/manifest` | Assigned security staff | Returns the assigned gate's ticket manifest. Response includes `Cache-Control: no-store`. |
| `POST /api/v1/sync/batch` | Security staff | Reconciles a batch of scanner records using client `scan_id` values. |
| `GET /api/v1/admin/metrics` | Administrator | Returns ticket/admission totals, gate capacity, and recent anomalies. `event_id` is an optional filter. |

For exact response fields, inspect the matching Laravel controller and API Resource. The login response currently has `token` and `user`; it does not promise the extra `token_type`, `email`, `created_at`, or `student_id` fields shown in the reference. The metrics resource currently reports `pending_sync_estimate: null` because scanner heartbeat counts are not implemented. Clients must render this as unavailable, not zero.

## Routes still to design

The current backend does **not** yet expose the full product API. Do not present these capabilities as implemented:

- student ticket wallet and ticket detail retrieval;
- event creation, editing, cancellation/rescheduling, and publication;
- gate setup and staff assignment management;
- complete, filterable audit-log browsing;
- scanner heartbeat and pending-sync telemetry.

Define routes and payloads for each capability from the existing `events`, `event_gates`, `event_gate_staff_assignments`, `tickets`, and audit models. Do not copy the reference's `registrations`, `access_points`, `/me/tickets`, or `/staff/events/.../admissions` names without a deliberate schema and ADR review.

## Rules for new endpoints

1. **Document before wiring a screen.** Record method, path, role, assignment scope, request fields, response fields, status codes, and retry/cache behavior in the endpoint contract.
2. **Keep validation and business rules server-side.** Use a Form Request for new request validation. Controllers stay thin; transaction, capacity, state-transition, and reconciliation rules belong in services.
3. **Preserve established payload shapes.** Existing endpoints return endpoint-specific JSON objects. Do not add a global `{ "data": ... }` wrapper or rename fields as cleanup without a versioned migration plan for every client.
4. **Return precise domain outcomes.** Use ordinary HTTP status codes and stable machine-readable outcomes for scan/sync results. Distinguish an identical idempotent retry from a new scan of an already admitted ticket and from a conflicting reuse of a scan ID.
5. **Make retry safety explicit.** Sync clients persist one UUID v4 `scan_id` per optical scan and resend that same ID after timeouts. The database uniqueness constraint and reconciliation service are authoritative.
6. **Protect event changes and admissions.** Use the existing database locking/transaction rules. Keep event lifecycle changes, gate assignment changes, ticket changes, and admissions in the same server-authoritative state model; document lock ordering for new concurrent writes.
7. **Minimize sensitive data.** Include only fields the caller needs. Never log bearer tokens, TOTP seeds, QR payloads, passwords, or full manifest responses. Only assigned gate staff may download their gate manifest.
8. **Choose caching per resource.** Sensitive ticket or manifest responses must not pass through shared caches. Use explicit `Cache-Control: no-store` for secret-bearing responses.
9. **Keep clients honest.** Screens render the server's status and timestamps; client-side role checks are navigation only. Offline scanner acceptance is provisional until the sync reconciliation completes.
10. **Test the contract.** New routes need feature coverage for role denial, validation, success, and the relevant failure/retry/concurrency paths, consistent with [the testing rule](../.agents/rules/04-testing.md) when available to the project team.

## Error behavior

- `401`: no valid authenticated user/token.
- `403`: authenticated user lacks the required role or assignment.
- `404`: requested resource is unavailable or outside the caller's resource scope, according to the route's privacy policy.
- `409`: conflicting use of an idempotency key or another concurrent state conflict.
- `422`: invalid input or a domain rule blocks the operation.
- `429`: route throttle limit reached.

Validation errors use Laravel's JSON `message` and `errors` fields. For scanner outcomes, clients should also receive and branch on a stable domain outcome; display copy may change without changing that outcome. Do not claim every listed status is already emitted by every current route: inspect the current controller/service before implementing a client branch.

## Contract review checklist

Before merging a new API change, verify that the route's role and resource scope are enforced in Laravel; the response does not expose unrelated student data or secrets; retries cannot double-apply a scan; and the route is listed as implemented here only after its code exists. Never commit `.env` files, Supabase keys, mobile secrets, or production tokens.

# 07 - REST API Endpoint Contracts

## 1. Authentication Endpoints

### `POST /api/v1/auth/login`
Authenticates the three end-user roles: Students, Security Staff, and Administrators. Students identify with their student number; Security Staff and Administrators identify with their institutional email.
* **Request Body:**
  ```json
  {
    "identifier": "2023-01042",
    "password": "SecurePassword123"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "token": "1|sanctum_token_string",
    "user": {
      "id": 142,
      "student_number": "2023-01042",
      "name": "Juan Dela Cruz",
      "role": "student"
    }
  }
  ```

---

## 2. Gate Manifest Partition Download

### `GET /api/v1/gates/{gate_id}/manifest`
Downloads the partitioned manifest for a specific gate prior to event ingress.
* **Headers:** `Authorization: Bearer <sanctum_token>` (Role: `security_staff`; manifest access is restricted to the user's assigned gate).
* **Response (200 OK):**
  ```json
  {
    "gate_id": 1,
    "event_status": "scheduled",
    "manifest_version": 1,
    "tickets": [
      {
        "ticket_id": 10492,
        "student_number": "2023-01042",
        "totp_secret": "0123456789abcdef0123456789abcdef01234567",
        "gate_id": 1,
        "status": "unclaimed"
      }
    ]
  }
  ```

---

## 3. Opportunistic Batch Sync

### `POST /api/v1/sync/batch`
Receives batches of up to 50 encrypted-at-rest scanner records. Each record includes the QR time-step and one-time code so the server can verify the HMAC before changing ticket state; the code is not persisted in scan logs.
* **Headers:** `Authorization: Bearer <sanctum_token>` (Role: `security_staff`).
* **Request Body:**
  ```json
  {
    "device_id": "MSEUF-SCANNER-GATE1-A",
    "scans": [
      {
        "scan_id": "c71a3994-e38c-4a37-9759-4b6e594d4d14",
        "ticket_id": 10492,
        "gate_id": 1,
        "scanned_at": 1727219045000,
        "is_override": false,
        "event_configuration_version": 12,
        "code_step": 57573968,
        "code": "482901"
      }
    ]
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "processed": 1,
    "acknowledged_scan_ids": [
      "c71a3994-e38c-4a37-9759-4b6e594d4d14"
    ],
    "outcomes": [
      {
        "scan_id": "c71a3994-e38c-4a37-9759-4b6e594d4d14",
        "decision": "accepted",
        "reason_code": null
      }
    ],
    "anomalies_logged": 0
  }
  ```

---




## 4. Live Admin Metrics Endpoint

### `GET /api/v1/admin/metrics`
Polled by the Administrator Web Dashboard every 5–10 seconds.
* **Authorization:** Administrator role only.
* **Response (200 OK):**
  ```json
  {
    "total_issued": 1200,
    "total_admitted": 842,
    "pending_sync_estimate": null,
    "gates": [
      { "gate_id": 1, "name": "Main Entrance", "admitted": 410, "capacity": 600 },
      { "gate_id": 2, "name": "Gymnasium Gate", "admitted": 432, "capacity": 600 }
    ],
    "anomalies_count": 2,
    "recent_anomalies": [
      {
        "id": 12,
        "ticket_id": 10201,
        "anomaly_type": "SPLIT_BRAIN_COLLISION",
        "device_id": "MSEUF-SCANNER-GATE2-A",
        "server_received_at": "2026-09-24T14:10:00Z"
      }
    ]
  }
  ```
---

## 5. Administrator Event Setup and Gate Assignment

All endpoints in this section use `Authorization: Bearer <sanctum_token>` and the `administrator` role. These endpoints return endpoint-specific JSON without a global `data` wrapper.

### `GET /api/v1/admin/event-options`

Returns the available venues with their physical gates, plus security staff eligible for assignment:

```json
{
  "venues": [
    { "id": 2, "name": "University Gymnasium", "location_details": "Campus east", "gates": [{ "id": 4, "code": "EAST", "name": "East Entrance" }] }
  ],
  "security_staff": [{ "id": 18, "name": "Security Staff A", "email": "staff@example.edu" }]
}
```

### `GET /api/v1/admin/events` and `GET /api/v1/admin/events/{event}`

The list returns at most 100 events, ordered by start time descending. Detail returns one event. Both use the event fields `id`, `venue_id`, `venue`, `name`, `description`, `starts_at`, `ends_at`, `status`, `configuration_version`, and `event_gates`. Gate entries contain their physical `venue_gate_id`, code/name, optional capacity, and assigned staff identities.

### `POST /api/v1/admin/events`

Creates a `draft` event at configuration version 1. Request fields are `venue_id`, `name`, optional `description`, `starts_at`, and `ends_at`; the end must follow the start. Returns the event with HTTP 201 and records `event_created` in `event_change_logs`. Gate assignments are configured with the separate gate endpoint.

### `PATCH /api/v1/admin/events/{event}`

Accepts a non-empty subset of `name`, `description`, `starts_at`, `ends_at`, and `status`, with optional `reason`. Status transitions are `draft -> scheduled|cancelled`, `scheduled -> in_progress|postponed|cancelled`, `in_progress -> postponed|cancelled|completed`, and `postponed -> scheduled|cancelled`. Cancelled and completed are terminal. Cancellation, postponement, rescheduling a non-draft event, and resuming a postponed event require a reason. Invalid transitions or missing reasons return 422. Each actual update locks the event row, increments its configuration version, and inserts a change log in one database transaction.

### `PUT /api/v1/admin/events/{event}/gates`

Request body:

```json
{
  "gates": [{ "venue_gate_id": 4, "capacity": 300, "security_staff_ids": [18, 23] }],
  "reason": "Move overflow staff to the east entrance"
}
```

Every physical gate must belong to the event venue, each staff ID must be a security-staff user, and capacity is null or a positive integer. Draft assignments are replaceable, except that a gate with tickets or scan history cannot be removed. After scheduling, this endpoint is additive: previously assigned gates and staff cannot be removed because scanners may hold offline manifests and their queued scans still need authorization. Real changes increment the event configuration version and store old/new gate snapshots. A post-draft change requires a reason; capacity cannot be lowered below admissions already synchronized. Since offline scanners may have unsynced scans, capacity is not a hard real-time occupancy limit. Cancelled and completed events reject gate changes.

The manifest endpoint returns 409 unless the event is scheduled or in progress and includes `event_status`. A disconnected scanner can still hold a prior manifest; cancellation or postponement cannot invalidate it until that scanner reconnects.

---

## 6. Student Ticket Wallet

### `GET /api/v1/student/tickets`
Returns only the authenticated student's tickets and event/gate display information. The route requires the `student` role. Active ticket TOTP secrets are included only for scheduled or in-progress events; revoked, draft, postponed, cancelled, and completed tickets do not return a usable secret. The response uses `Cache-Control: no-store`.

The mobile client stores the ticket snapshot in Expo SecureStore and calculates its 30-second code locally. QR contents use `EUEVENT1:<ticket_id>:<time_step>:<six_digit_code>`; they never contain the TOTP secret.

## 7. Administrator Ticket Issuance

### `POST /api/v1/admin/events/{event}/tickets`
Requires the `administrator` role. Request:

```json
{
  "student_number": "2023-01042",
  "event_gate_id": 4
}
```

The student account must already exist and have the `student` role. The gate must belong to the selected event. Issuance enforces the gate's configured capacity and prevents duplicate active tickets; a revoked ticket may be reissued with a newly generated secret. The operation locks the event and gate rows, increments the event configuration version, and records a `ticket_issued` change log. The 201 response contains the ticket ID, student number, gate ID, status, and configuration version, but never the secret. Validation and capacity conflicts return 422.

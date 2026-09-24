# 07 - REST API Endpoint Contracts

## 1. Authentication Endpoints

### `POST /api/v1/auth/login`
Authenticates students, marshals, and administrators.
* **Request Body:**
  ```json
  {
    "student_number": "2023-01042",
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
* **Headers:** `Authorization: Bearer <sanctum_token>` (Role: `scanner` or `admin`).
* **Response (200 OK):**
  ```json
  {
    "gate_id": 1,
    "manifest_version": 1727218900,
    "tickets": [
      {
        "ticket_id": 10492,
        "student_number": "2023-01042",
        "totp_secret": "JBSWY3DPEHPK3PXP",
        "gate_id": 1,
        "status": "unclaimed"
      }
    ]
  }
  ```

---

## 3. Opportunistic Batch Sync

### `POST /api/v1/sync/batch`
Receives compressed batches of 25–50 un-synced scan records from mobile scanners.
* **Headers:** `Authorization: Bearer <sanctum_token>`
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
        "is_override": false
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
    "anomalies_logged": 0
  }
  ```

---

## 4. Live Admin Metrics Endpoint

### `GET /api/v1/admin/metrics`
Polled by the React Web Admin dashboard every 5–10 seconds.
* **Response (200 OK):**
  ```json
  {
    "total_issued": 1200,
    "total_admitted": 842,
    "pending_sync_estimate": 45,
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

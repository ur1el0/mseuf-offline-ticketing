# 01 - System Overview & Distributed MVC Architecture

## 1. Executive Summary
The **MSEUF Events Offline Ticketing System** is an offline-first cryptographic admissions management platform engineered for university events (e.g., Foundation Week, University Days, concerts, sporting meets) at Manuel S. Enverga University Foundation (MSEUF).

University venue gates (e.g., University Gymnasium, Main Gate, Sports Complex) frequently experience complete cellular blackout or severe bandwidth throttling during mass crowd ingress. The system guarantees sub-second attendee admission verification with zero live network dependency, while eliminating screenshot fraud, double-spending, and multi-device split-brain synchronization anomalies.

---

## 2. Architectural Blueprint: Distributed Model-View-Controller (MVC)

To satisfy academic midterm assessment criteria requiring strict MVC adherence without leaking business logic into presentation layers, the system is architected as a **Distributed MVC**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AUTHORITATIVE SERVER MVC (Laravel)                            │
│  [Model: Eloquent + PostgreSQL]  <-->  [Controller: REST API]  <-->  [View: JSON / React] │
│   - Pessimistic Locking (5432)          - Sanctum Auth                 - Live Metrics   │
│   - Cryptographic Seed Issuance         - Sync Reconciliation          - HTTP Polling   │
│   - Authoritative Tie-Breakers          - Audit Logging                                 │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ Opportunistic Sync / Periodic Heartbeat
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT REPLICA MVC (React Native)                            │
│  [Model: expo-sqlite]            <-->  [Controller: TOTP / Sync] <--> [View: Vector QR / UI]│
│   - local_manifest                      - otpauth Engine (RFC 6238)    - react-native-   │
│   - pending_sync_queue (UUID v4)        - Marshal Override Logic         qrcode-svg     │
│   - expo-secure-store (Seeds)           - Scanner Clock Trust Anchor   - Scanner HUD    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The Two MVC Realities

1. **Authoritative Server MVC (Laravel REST API & Supabase PostgreSQL):**
   - **Model:** PostgreSQL schema managed by Eloquent Models (`User`, `Ticket`, `ScanLog`, `AuditLog`). Acts as the single source of truth for ticket ownership, issuance, and audit logs.
   - **Controller:** REST API Controllers (`TicketSyncController`, `TicketIssuanceController`, `AuthController`) orchestrating validation via FormRequests and business rules via Domain Services.
   - **View:** Structured JSON API responses and the Web Admin Dashboard (React + TypeScript).

2. **Client Replica MVC (React Native Expo Mobile Applications):**
   - **Model:** Local persistent state stored in `expo-sqlite` (`local_manifest`, `pending_sync_queue`) and hardware-encrypted seeds stored in `expo-secure-store`.
   - **Controller:** Client domain controllers (`totpController`, `scannerController`, `syncController`, `marshalOverrideController`) handling cryptographic evaluation, local admission states, and store-and-forward syncing.
   - **View:** Declarative UI screens (`ScannerScreen`, `StudentTicketScreen`) displaying camera HUDs, status badges, and SVG vector QR codes (`react-native-qrcode-svg`).

---

## 3. Physical Venue Topology & Operational Constraints

```
                                    MSEUF Campus
                       ┌─────────────────────────────────────┐
                       │   Main Gate (Gate 1) - Scanner 1A   │
                       │   Main Gate (Gate 1) - Scanner 1B   │
                       ├─────────────────────────────────────┤
                       │   Gymnasium Gate (Gate 2) - Scnr 2A │
                       │   Gymnasium Gate (Gate 2) - Scnr 2B │
                       ├─────────────────────────────────────┤
                       │   Sports Field (Gate 3) - Scnr 3A   │
                       └──────────────────┬──────────────────┘
                                          │
                  [Offline Period: Zero Cellular / Wi-Fi]
                  - Scanner validates against local_manifest
                  - Scans buffered in pending_sync_queue
                                          │
               [Opportunistic Connectivity Restored (Heartbeat)]
                                          │
                                          ▼
                       ┌─────────────────────────────────────┐
                       │  Authoritative Supabase PostgreSQL  │
                       │  Session Pooler (Port 5432)         │
                       │  Pessimistic Locking / Deduplication│
                       └─────────────────────────────────────┘
```

### Key Venue Dynamics:
* **Dead Zones:** High-density crowd areas cause cellular tower saturation. Scanners cannot rely on HTTP calls at the moment of scanning.
* **Gate Partitioning:** Tickets are pre-allocated to specific gates (`gate_id`) to reduce fraud surfaces across disparate physical entrances.
* **Surge Conditions:** If a bottleneck occurs at Gate 1, authorized marshals use a PIN override to reroute and force-admit attendees while capturing full audit telemetry.

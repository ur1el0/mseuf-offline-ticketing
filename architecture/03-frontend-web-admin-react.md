# 03 - Web Admin Dashboard Architecture (React + TypeScript)

## 1. Overview
The Web Admin Dashboard provides real-time situational awareness for MSEUF event organizers and security staff. It visualizes campus-wide admission throughput, monitors gate health, tracks offline sync queues, and exposes forensic logs for split-brain collisions and marshal overrides.

---

## 2. Technical Stack
* **Framework:** React 19 SPA initialized with Vite.
* **Language:** TypeScript (Strict Mode enabled).
* **Styling:** Tailwind CSS with accessible, high-contrast badges for live gate statuses.
* **Icons:** Lucide React.
* **Network Strategy:** Clean HTTP interval polling (`setInterval` / React Query) against `/api/v1/admin/metrics`. **Zero WebSocket dependency** to eliminate presentation-day deployment and firewall failures.

---

## 3. UI Component Hierarchy & Modularity

```
App
└── AdminDashboardLayout
    ├── NavigationHeader
    ├── MetricsSummaryGrid
    │   ├── TotalIssuedCard
    │   ├── TotalAdmittedCard
    │   ├── PendingSyncCard
    │   └── AnomalyCountCard
    ├── GateThroughputPanel
    │   └── GateProgressBarCard (Gate 1, Gate 2, Gym)
    ├── ForensicAlertFeed (Collisions & Gate Mismatches)
    └── MarshalOverrideLogTable
```

---

## 4. Polling Strategy & Reliability

* **Interval:** Polling triggers every 5 seconds under active event conditions (fallback to 10s on idle).
* **Graceful Degradation:** If network polling fails momentarily, the UI displays a subtle "Reconnecting..." indicator without tearing down the existing metrics DOM tree or throwing unhandled JavaScript runtime errors.
* **Visual Anomaly Encoding:**
  * **Green (`bg-emerald-500`):** Normal, valid ticket admission.
  * **Amber (`bg-amber-500`):** Marshal Override PIN bypass.
  * **Red (`bg-rose-500`):** Split-Brain Collision anomaly requiring immediate staff attention.

---
trigger: always_on
---

# Rule 03: React Web Admin Dashboard Standards

These standards govern the implementation of the event monitoring dashboard.

### 1. HTTP Polling Only (Zero WebSocket Dependency)
* **Rule:** Do NOT use WebSockets, Pusher, or Socket.io.
* **Practice:** Live dashboard metrics must update via standard HTTP interval polling (5s–10s cadence) against `/api/v1/admin/metrics`. Use clean React custom hooks (`useAdminMetrics`) with `setInterval` or React Query refetch intervals. This eliminates presentation-day network failure risks.

### 2. Component Modularity & Clean UI
* **Rule:** Parent view components must remain focused on layout and composition.
* **Practice:** Extract metrics cards, alert feeds, and override logs into dedicated modular sub-components within `components/metrics/`, `components/alerts/`, and `components/audit/`.

### 3. Styling & Accessibility
* **Rule:** Fully responsive layout with high-contrast accessibility badges for gate statuses.
* **Practice:** Use Tailwind CSS utility classes. Explicitly color-code anomalies:
  * Green: Valid admission.
  * Amber: Marshal Override PIN bypass.
  * Red: Split-Brain Collision anomaly.

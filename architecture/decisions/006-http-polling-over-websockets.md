# ADR 006: HTTP Interval Polling over WebSockets for Admin Metrics

## Status
Accepted

## Context
Real-time dashboard architectures frequently adopt WebSockets (e.g. Pusher, Socket.io, Laravel Reverb). However, for classroom presentations, academic midterm defenses, and campus network firewalls, WebSockets introduce severe operational risks (dropped socket handshakes, proxy blocking, stale socket states). A WebSocket failure during an oral defense can result in an unfair grading deduction.

## Decision
We enforce standard **HTTP interval polling** (5s–10s cadence) for the Web Admin Dashboard:
1. React Web Admin polls `/api/v1/admin/metrics` using clean React hooks or React Query.
2. In the event of a momentary network blip, the client simply retries on the next interval without crashing.
3. Completely eliminates WebSocket server dependencies, reducing infrastructural complexity.

## Consequences
- **Positive:** Bulletproof delivery reliability for midterm examination evaluation; zero WebSocket runtime failure risks; trivial to inspect and debug via browser network tools.
- **Negative:** Slight network overhead compared to push notifications, negligible for administrative monitoring.

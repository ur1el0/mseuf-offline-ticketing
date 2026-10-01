# EUEvent Design Decisions and UI Guidance

This guide records choices that are accepted for this project and explains how new architectural decisions are made. Detailed domain decisions live in [`architecture/decisions/`](../architecture/decisions/). The decisions in the supplied Ingress examples were reviewed selectively; they are not automatically requirements for EUEvent.

## Accepted technical direction

| Area | Current decision | Reference |
| --- | --- | --- |
| Application structure | Distributed MVC: Laravel API and domain services, React administrator client, Expo mobile clients. | [ADR 001](../architecture/decisions/001-distributed-mvc-architecture.md) |
| Student ticket | Rotating RFC 6238 TOTP QR; a static QR is not accepted. | [ADR 002](../architecture/decisions/002-rfc6238-totp-dynamic-qr-over-static-codes.md) |
| Time authority | Scanner clock validates the student's rotating token. | [ADR 003](../architecture/decisions/003-scanner-hardware-clock-as-trust-anchor.md) |
| Offline sync | UUID v4 `scan_id`, persisted before sending and reused on retries. | [ADR 004](../architecture/decisions/004-uuid-v4-idempotent-sync-keys.md) |
| Admin refresh | HTTP polling; no WebSocket dependency for dashboard metrics. | [ADR 006](../architecture/decisions/006-http-polling-over-websockets.md) |
| Local scanner data | Expo SQLite is used for structured offline queue data, subject to the secret-storage issue in the architecture guide. | [ADR 007](../architecture/decisions/007-expo-sqlite-over-native-cpp-bridges.md) |
| Operational exception | Marshal override is a staff capability with an auditable result, not a fourth user role. | [ADR 008](../architecture/decisions/008-marshal-pin-override-contingency.md) |

A decision is **accepted** only when recorded in a project ADR or an existing project rule. A reference, screenshot, generated code example, or downloaded document alone does not change the system.

## External-reference review

The supplied Ingress documents describe a related but different system. We adopt useful engineering practices and reject details that contradict EUEvent's requirements or existing implementation.

| Idea from the reference material | EUEvent treatment |
| --- | --- |
| Document each endpoint's role, payload, status, and failure behavior. | Adopt. Keep the current endpoint inventory in [`api.md`](api.md) and payload examples in the numbered architecture specification. |
| Give retries stable client-generated IDs and define concurrency outcomes. | Adopt. Use this project's `scan_id`, `tickets`, `event_gates`, audit model, and offline reconciliation behavior. |
| Include a practical secret-compromise threat model. | Adopt. Apply it to the existing encrypted TOTP seed and manifest flow; do not substitute the reference's opaque `ingress:v1` credential. |
| Check authorization on the server and keep sensitive QR material out of logs. | Adopt. UI visibility is never a security boundary. |
| Gate predictable demo accounts behind an explicit opt-in and forbid them in production. | Adopt as a rule if demo users are introduced. This does not mean such accounts or a demo mode currently exist. |
| Replace React administration with Laravel Blade. | Reject. The approved client architecture is React + TypeScript; Laravel remains the API and domain layer. |
| Fail closed whenever a scanner loses server connectivity. | Reject. The scanner must admit valid tickets offline against its assigned manifest and reconcile later. Cross-gate conflicts while disconnected are a known limitation and must be logged on sync. |
| Replace the existing schema/routes with `registrations`, `access_points`, and Ingress endpoint names. | Reject. They do not match the current `tickets`, `event_gates`, `venue_gates`, role names, or API contracts. |
| Replace rotating TOTP QR with a long-lived opaque QR secret. | Reject. It changes the accepted ticket security model and would need a new product/security decision. |
| Adopt the sample's Laravel, PostgreSQL, Expo, and React Native version numbers or its plain-HTTP production posture. | Reject. Pin versions from the repository's own supported toolchain. Plain HTTP must not be treated as safe for bearer tokens or ticket secrets. |
| Import the sample's maroon/gold colors and Ingress logo. | Reject. Use EUEvent's supplied logo, brand PDF, and Figma prototype. |

## Visual system

The supplied EUEvent Brand Identity guide defines the core palette and typography. The Figma prototype supplies screen hierarchy and component placement. Use the EUEvent assets in `context/`; do not redraw, recolor, or replace the logo with a reference project's mark.

| Token | Value | Use |
| --- | --- | --- |
| Crimson Obsidian | `#1C0808` | Main dark background and navigation foundation. |
| Crimson Slate | `#2A1010` | Primary dark card/surface. |
| Saffron gradient | `#FFCB2F` to `#F2AE1D` | Primary actions and important focus states. |
| Pure white | `#FFFFFF` | High-contrast text and light dashboard surfaces. |
| Neon crimson maroon | Use the defined EUEvent asset/token where supplied; do not invent a hex value from the name alone. | Brand accent and selected states. |
| Quicksand | UI typography. | Event information, controls, and navigation. |
| Barlow | Brand typography. | Product wordmark and top-level brand treatment. |

The brand guide calls for a dark, high-contrast visual system. The desktop Figma prototype also uses a light content canvas and white data cards; those are acceptable in the admin content area when the dark maroon navigation and EUEvent accents remain clear. Student and scanner surfaces should retain the dark, low-light-friendly treatment.

### Shape, icons, and interaction

- Use soft rounded geometry throughout: about 12–16 px for controls, 16–20 px for cards, and pill shapes for status and filter controls. Keep radii consistent within a screen.
- Prefer rounded outline icons with curved joins and caps (for example, Lucide's default stroke style). Avoid sharp, point-heavy symbols when a rounded equivalent exists. Icon shape does not replace a text label.
- Use saffron to focus attention, not as a large text color on light surfaces. Check contrast for every text/background pair.
- Never communicate scan outcomes by color alone. Include a clear label and symbol for valid, invalid/expired, wrong-gate, duplicate, override, and server/sync states.
- Keep mobile tap targets at least 44 × 44 points, maintain visible keyboard focus on web, and respect system font scaling.
- Give rotating student tickets a visible expiry countdown and refresh state. A QR code must remain large, legible, and free of decorative overlays that interfere with scanning.

## Adding or changing a decision

Write an ADR when a change affects security, offline admission/reconciliation, data ownership, schema boundaries, deployment topology, or a required dependency. Small reversible layout details can follow this guide without an ADR.

Use these sections and mark the state `Proposed`, `Accepted`, `Rejected`, or `Superseded`:

```md
# ADR NNN: Short decision title

- Status: Proposed
- Date: YYYY-MM-DD

## Context
What requirement or failure mode needs a decision?

## Options considered
List viable options and their costs.

## Decision
State the selected approach and constraints.

## Consequences
Record security, offline, migration, testing, and operational effects.
```

Before accepting an ADR, check it against the three-role product definition, existing migrations/routes, offline scanner requirements, the brand guide, and `.agents/rules/`. Supersede an old ADR with a link; do not silently rewrite a decision that clients or data already depend on.

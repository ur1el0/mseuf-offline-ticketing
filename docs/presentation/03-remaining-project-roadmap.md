# The next half of the project: proposed roadmap

“The other 50%” is a useful milestone phrase, not a measured score. The codebase has substantial working slices across the API, dashboard, and mobile app, but completion depends on the instructor's rubric and whether it weights features, testing, deployment, or operational readiness. This roadmap defines evidence that would make the next milestone credible. It does not claim those items are already complete.

## Where the current build stands

The current `main` build includes:

- Administrator sign-in, account provisioning, venue/gate setup, event lifecycle and gate/staff assignments, ticket issuance/revocation, activity logs, and dashboard metrics.
- Student sign-in and ticket wallet with a locally generated rotating 30-second QR.
- Staff sign-in, assignment-scoped gate manifests, local QR checks, a per-device duplicate guard, encrypted local queue, retry-safe scan IDs, and server reconciliation.
- Automated backend tests for role access, event/ticket rules, scan decisions/retries, token lifetime, ticket revocation, and demo seeding; mobile QR validation tests also exist.

These implemented paths still need a repeatable physical end-to-end rehearsal on the target phones and network before they should be described as proven in the presentation. A passing isolated test proves its assertions, not that the complete event-day workflow was rehearsed.

## Prioritized roadmap

### Phase 1 — Close the live demo path

**Goal:** Make the core flow reliable and easy to judge on the actual presentation hardware.

- Rehearse the complete path: create/schedule event → assign gate and staff → create student → issue ticket → student loads pass → scanner preloads manifest → online scan → API-only outage scan → reconnect and reconcile.
- Run it with a fresh local demo database and document the exact seed/setup choices and reset method.
- Verify different outcomes on a physical scanner: current pass, expired QR, wrong event/gate, used ticket, revoked ticket, inactive event, and API unreachable.
- Confirm visual labels clearly distinguish provisional local success, server-confirmed entry, and server rejection.
- Record target Android/iOS versions, phone clock settings, local Wi-Fi topology, and any Expo Go constraints.

**Exit evidence:** A dated rehearsal checklist with device/build versions, screenshots that contain no secrets, successful expected results, and any known failure procedure. Complete one run without hand-editing production data or skipping a control.

### Phase 2 — Define event-day offline operations

**Goal:** Give staff a safe, low-confusion procedure for stale data and disconnected gates.

- Set a manifest freshness policy: who checks versions before opening, when a scanner should stop accepting offline passes, and how stale-manifest warnings are handled.
- Define cancellation, revocation, wrong-gate, connectivity-loss, clock-drift, and later-rejected-scan procedures for the event lead and gate team.
- Provide a clear reconciliation review that groups rejected offline scans, duplicate cross-device conflicts, and stale-manifest anomalies for an administrator.
- Keep local scanning independent of network retries and communicate the pending queue size and oldest scan time to staff.
- Train staff not to use a QR screenshot, name list, or undocumented PIN override as if it were equivalent to a server-confirmed ticket.

**Exit evidence:** A written runbook accepted by the event team, a tabletop exercise for an API outage and wrong-gate line, and tested scanner UI for each supported decision.

### Phase 3 — Improve multi-scanner conflict handling

**Goal:** Reduce confusion when offline devices independently scan one ticket.

- Make the per-device duplicate result explicit and distinguish it from a server-detected cross-device collision.
- Show the reconciliation outcome and enough non-sensitive context for the event lead to review it.
- Define whether a single event LAN service, connected coordinator phone, or server reconnection is available at the venue before promising real-time cross-gate coordination.
- If proposing a local edge/coordinator mode, first document identity, trusted clock, conflict arbitration, data sync, crash recovery, and failure behavior in an ADR. A shared device or local server reduces some coordination delay but is another failure and security boundary.
- Do not add an override PIN just to make every scan green. If a human override becomes a requirement, require an explicit event policy, supervisor authorization, reason, durable audit record, rate limits, and a safe offline key/provisioning plan.

**Exit evidence:** A requirements decision accepted by the event stakeholders, architecture review, conflict test with two devices, and audit review of every permitted resolution path.

### Phase 4 — Complete account and session recovery

**Goal:** Recover students and staff safely without an administrator sharing long-term passwords.

- Implement a verified student credential reset that does not expose whether an email/account exists and does not disclose a password to the dashboard.
- Decide how institutional email delivery is configured and verified for the deployed environment; a “check your inbox” screen is not proof that delivery succeeded.
- Add password change, token revocation, and clear session-expired handling to the clients.
- Decide how staff access is revoked and what happens to encrypted pending scans when a staff account is disabled or its token expires.
- Add recovery and expiry regression tests, including mobile queue preservation across reauthentication.

**Exit evidence:** End-to-end recovery tests using a controlled mail sink or institutional mail environment, expired-session tests, no credential leakage in logs, and a documented support procedure.

### Phase 5 — Prepare for controlled deployment

**Goal:** Move from a Fedora demo to a secure environment without changing the ticket trust model accidentally.

- Build/install signed standalone Android and iOS apps; verify camera, SecureStore, encrypted SQLite, background/foreground transitions, app updates, and backups on real devices.
- Deploy the Laravel API behind HTTPS with managed secrets, secure database access, migrations, rate limits, error reporting, and a tested backup/restore procedure.
- Choose the event venue's network and availability design: hosted API, venue Wi-Fi, or a deliberately engineered local node. Do not assume a stable phone-reachable IP or internet access without verifying at the site.
- Configure production domains, CORS/client API URLs, database connection pooling, logging retention, monitoring, and incident contacts.
- Test database restore and API failure recovery before using real attendee information.

**Exit evidence:** Reproducible deployment instructions, signed app artifacts, successful restore drill, TLS verification, secret audit, and a controlled pilot plan.

### Phase 6 — Test operational scale and accessibility

**Goal:** Find bottlenecks and confusing feedback before crowd conditions reveal them.

- Measure local QR validation latency and sync batch behavior on representative phones with realistic manifest sizes.
- Test burst scanning, slow storage, low battery, camera permission denial, app backgrounding, process restart, queue growth, and network flapping.
- Add focused API/client end-to-end tests for the user-visible event flow and multi-scanner race; keep unit and feature tests for deterministic domain behavior.
- Review accessibility: text scaling, screen-reader labels, contrast, non-color-only outcomes, touch-target size, camera failure alternative, and clear sound/haptics policy.
- Establish retention and privacy rules for student data, ticket history, device IDs, and audit records.

**Exit evidence:** Recorded performance measurements and acceptance thresholds, repeatable automated tests for critical flows, an accessibility review, and signed-off data-retention rules.

## Scope order for a student milestone

If time is limited, do the work in this order:

1. **Must show:** repeatable admin → student ticket → staff manifest → online scan → offline queue → sync flow.
2. **Must explain:** stale manifest, wrong gate, screenshot replay window, token expiration, and two disconnected scanners.
3. **Must prepare:** deployment/run instructions and a physical rehearsal record.
4. **Next if schedule allows:** student recovery, better conflict review, queue telemetry, and a signed standalone app.
5. **After that:** production availability and site-specific coordination design.

Payments, ticket sales, and an unreviewed distributed edge server are not implied by this plan. Add them only if a requirement or stakeholder needs them and the team can test them.

## Progress reporting rule

Report the completed requirements and their evidence, not a language-share graph or a guess such as “we are 65% done.” If the course has a rubric, map each rubric item to a feature, test, demo step, or document. Recalculate a percentage from that mapping and state the weighting. Until then, call this list a proposed next milestone rather than an exact remaining percentage.

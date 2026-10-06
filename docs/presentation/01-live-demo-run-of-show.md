# Live demo run of show

This is a 10–15 minute demonstration of the current local build. It covers the three end-user roles and one controlled API outage. It assumes the presenter has rehearsed with the same Fedora machine, phones, and demo database that will be used in the room.

## What the demo proves

- An administrator can configure an event, gates, staff, and student tickets from the desktop dashboard.
- A student can retrieve their own pass and display a rotating QR generated on the phone.
- Assigned security staff can download a gate manifest, validate a pass locally, keep scanning during an API outage, and later receive a server decision when the queue syncs.
- The UI distinguishes local validation from server confirmation.

It does **not** prove that independent scanners can prevent a duplicate admission while completely disconnected. They cannot coordinate until a server or local network is available.

## Before presenting

### Prepare the devices and network

- Use the isolated Fedora/Lerd presentation database described in [the backend README](../../backend/README.md#local-presentation-mode). Do not use the shared Supabase database for a public demo.
- Connect Fedora, the dashboard browser, and the Expo phone to the same Wi-Fi or presentation router. The local API avoids WAN dependence; Wi-Fi between devices is still required.
- Keep the API terminal, Vite terminal, and Expo Metro terminal visible and ready. Expo Go needs Metro to keep delivering the app bundle. An installed app build is needed if local Wi-Fi or Metro itself may be unavailable.
- Use a student phone and a different staff phone if available. A second staff device is useful for explaining the multi-scanner limitation, but do not represent a simulated conflict as a test result.
- Turn on automatic date and time on the student and scanner phones. A large clock difference can make a live TOTP appear expired.
- Keep all real student data, passwords, `.env` files, ticket secrets, and QR payloads out of screenshots and recordings.

### Start the local services

The first-time setup and generated demo password are documented in [backend local presentation mode](../../backend/README.md#local-presentation-mode). Once setup is complete, start the API from `backend/`:

```bash
./scripts/start-presentation-demo.sh
```

Start the dashboard in a second terminal from `admin-web/`:

```bash
npm run dev -- --host 0.0.0.0
```

Its `.env` must point `VITE_BACKEND_ORIGIN` to `http://127.0.0.1:8002` for this local demo. Start the Expo app in a third terminal from `security-scanner/`:

```bash
npm run start:lan
```

The launcher checks the local API, finds Fedora’s current LAN address, and starts Expo with that API URL. Scan the Expo development QR with Expo Go. If a phone has a stale saved API address, update it in server settings before the rehearsal.

## Run of show

| Time | Presenter action | What should happen |
| --- | --- | --- |
| 0:00–1:00 | Introduce the student, security staff, and administrator roles. Show the three clients. | Audience sees one authoritative Laravel API with a desktop admin and two mobile experiences. |
| 1:00–2:00 | Sign in to the admin dashboard. Point out the live dashboard and activity log. | Administrator-only data loads from the local API. Metrics poll periodically; scanner heartbeat and pending-sync counts are not currently reported by the API. |
| 2:00–4:00 | Open Venues & gates. Use the seeded venue/Gate A or create a venue and gates. | Physical gates are configured once and reused when configuring events. |
| 4:00–6:00 | Create a draft event; select the venue; assign Gate A and the staff account; schedule the event. | Event history records meaningful configuration changes. A manifest is downloadable only for scheduled or in-progress events. |
| 6:00–7:00 | Create a student account and issue a ticket to that student's number at Gate A. Show its event ticket roster. | Laravel checks student eligibility, event gate, capacity, and existing ticket state. The QR secret is not returned to the dashboard. |
| 7:00–8:00 | Sign in to the student mobile app and refresh tickets. Show the ticket label and rotating QR. | The app stores the student's ticket snapshot and secret in SecureStore, then calculates a short-lived code on device. Avoid displaying the QR payload or secret in a recording. |
| 8:00–9:00 | Sign in to the staff mobile app. Open the assigned event and download Gate A's manifest while online. | The scanner has an encrypted, gate-scoped offline copy. Show its version/download status before entering scan mode. |
| 9:00–11:00 | Scan the student's live pass once with the Gate A scanner. | The scanner displays local validation and stores the scan. When connected, a background sync may quickly change the result to server-confirmed. Explain the two states. |
| 11:00–13:00 | Demonstrate an API-only outage: stop the Laravel API terminal while leaving Wi-Fi and Metro up. Scan a new valid pass/ticket prepared for the demo. | The scanner validates against its cached manifest and queues the result on the device. The scan should not block while waiting for Laravel. Its success is provisional, not a global admission guarantee. |
| 13:00–14:00 | Restart the API and use Sync or allow the scanner's retry. Show the final decision in the scanner and the admin activity/log view. | Laravel verifies the proof and event/ticket/gate state, records the result, and returns the authoritative decision. A rejected sync outcome requires staff review of the physical entry. |
| 14:00–15:00 | Summarize the fault boundary and the remaining roadmap. | The system remains useful during an API outage but cannot receive remote changes or coordinate two disconnected gates in real time. |

### Important: prepare two independent scan cases

One ticket should be enough to show a successful online pass. For the API outage segment, use another unclaimed ticket, another student account, or a fresh reissued ticket. The same physical ticket has already been recorded locally and should be rejected as a duplicate by that device. Do not clear scanner storage during the live demo to work around this control.

If the available seeded event is still a draft, create and schedule the event before trying to load a gate manifest. Draft events intentionally do not provide scanner manifests.

## Outage drill

For an API-only outage, stop the Laravel server but keep local Wi-Fi, the Expo app, and Metro running. Scan a valid current pass that exists in the scanner's downloaded manifest. Look for the locally validated/queued wording, then restart Laravel and sync. This tests the core offline queue path while avoiding an Expo Go bundle interruption.

Do not turn off Wi-Fi as a shortcut during an Expo Go demo. If the phone loses Metro, Expo Go may stop loading the JavaScript bundle; that tests the development transport, not the scanner's offline database. A standalone mobile build is the right setup for a demonstration where local Wi-Fi may disappear completely.

## Recovery plan

| Failure | Presenter response |
| --- | --- |
| Dashboard cannot reach the API | Check API terminal and `VITE_BACKEND_ORIGIN`; use the local demo API on port 8002. Continue from already-open screens only if the state is clear. |
| Expo Go cannot load/reload | Restore same-Wi-Fi access to Metro and the phone's API URL. Narrate the mobile step using the prepared rehearsal recording only if recordings are permitted; do not call that a live test. |
| No event appears | Verify that the dashboard is using the demo API/database. Create the event, assign its gates, and set it to scheduled before manifest download. |
| Manifest is stale | While online, refresh assigned gates and download the latest manifest before scanning. During a real outage, explain that later changes cannot reach the device. |
| QR rejected as expired | Verify automatic date/time on both devices, then ask the student to show the current QR and scan again in the next 30-second window. |
| Local success later rejected by server | State that offline acceptance was provisional. Pause or review the physical admission using the event's incident procedure; the software cannot reverse an entry already made. |

## After the rehearsal

Record which steps were genuinely exercised on physical devices, which used seed data, and any failures. Reset or discard the isolated demo database only after saving the evidence needed for grading. Never copy demo credentials, QR screenshots, or ticket secrets into a public repository or presentation slide.

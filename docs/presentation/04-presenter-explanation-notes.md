# Presenter explanation notes

Use these notes to explain the demonstration without overstating what the software guarantees. The sample wording is a guide; say it naturally and point to the matching screen or test.

## Opening: problem and roles

**Say:** “EUEvent coordinates three jobs at an event. Students show a ticket on mobile, security staff verify entry at assigned gates, and administrators configure the event and review the records. Laravel owns the final data and business decisions.”

**Explain:** The scanner is mobile because it is physically at the door and may lose access to the API. The dashboard is desktop-oriented because event setup and review involve longer forms and operational lists. One Expo app presents either the student or staff experience after role-aware sign-in.

## Admin: event, gate, staff, and ticket

**Say:** “We model the physical place first, then attach event gates and staff. A ticket is issued for a student and a specific event gate. Laravel checks that the student exists, the gate belongs to this event, the ticket is not already active, and capacity has not been reached.”

**Explain:** React is not trusted to enforce these rules. The API validates again and a Laravel service groups the database changes in a transaction. The ticket's secret is generated on the server and stored encrypted; the admin response does not include that secret. Meaningful event changes are logged and version the configuration used by scanners.

**Django comparison:** “If you know Django, think URL route → authentication/permission → request validation → thin API view → domain service → ORM transaction → JSON resource. The service layer is where we keep multi-step ticket rules, similar to putting business operations in a dedicated service/use-case module instead of growing a view function.”

## Student: why a rotating QR

**Say:** “The phone calculates a new short-lived proof from a secret saved in secure device storage. The QR carries a ticket identifier, a time step, and a six-digit code, not the student's personal information or the secret itself.”

**Explain:** TOTP divides time into 30-second steps and computes a code using HMAC-SHA1. The scanner checks the step with its own clock. A static image becomes outdated at the next step, reducing the time a copied image can be reused.

**Be precise about screenshots:** A screenshot shown during the same valid 30-second step may still pass if the scanner has not already seen that ticket. The same scanner has a duplicate guard; another disconnected scanner cannot know that it was already shown elsewhere. Therefore, the accurate claim is “short replay window and replay detection in known state,” not “screenshots are impossible.”

## Staff: gate manifest and preflight

**Say:** “Before opening, the staff member downloads the manifest for an assigned gate. It contains the data the scanner needs to verify tickets locally, and the app encrypts it before saving it on the phone.”

**Explain:** Assignment authorization is checked by Laravel on manifest download. A gate-specific manifest reduces the data each device needs and helps reject a pass intended for another entrance. Show the manifest version and download time before scanning. If it is old and the API is available, refresh it before admitting people.

## Scan result: local versus server

**Say:** “This first result means the QR matches the locally saved manifest and has been recorded on this device. If we are offline, it is provisional. When Laravel receives the batch, it makes the authoritative decision and returns the server result.”

**Explain:** The scanner writes the scan to an encrypted queue before it attempts synchronization. It gives the scan a UUID once and reuses it on retry. That prevents an interrupted network request from counting the same captured scan twice. Laravel rechecks proof, ticket status, event status, and gate. A dashboard count is server-recorded data; it cannot include unsynchronized scans if the API does not report them.

## What happens when internet is poor?

**Say:** “A poor internet connection does not automatically stop a prepared scanner. If the scanner has a valid cached manifest and the student has the ticket saved, local QR checking and queueing still work. Sync waits for the API.”

**Explain:** There are two separate links: internet-to-hosted-server and local-Wi-Fi-to-Fedora/phone. For the Fedora presentation, Laravel and PostgreSQL can stay on the local machine, so the public internet is not part of each scan. The phone still needs the venue's local Wi-Fi to reach that machine when refreshing or syncing. Expo Go also depends on Metro while running; a standalone build is better if the local Wi-Fi itself may fail.

## Likely questions and accurate answers

### “What if both the student and the scanner are offline?”

**Answer:** “That is supported after preparation. The student phone calculates the current code locally. The scanner uses its downloaded encrypted manifest to check it locally, queues the scan, and shows provisional success. Neither phone needs to contact Laravel for that local check.”

### “What if staff scans a screenshot?”

**Answer:** “The code rotates every 30 seconds and the scanner checks the current step, so an older screenshot expires. A screenshot copied within its current step may still work once on a scanner that has not seen that ticket. Rotation narrows the replay window but does not prove who is holding the phone.”

### “Will two offline scanners admit the same ticket?”

**Answer:** “They can both provisionally accept it because isolated phones cannot share scan state. On reconnect, Laravel accepts one claim and records the other as a conflict. That is detection after the fact, not prevention at the door. The event needs an offline operating procedure; real-time coordination would require an available shared coordinator or network service and a separate design review.”

### “What if a student goes to the wrong venue or gate?”

**Answer:** “The scanner compares the ticket to its assigned gate manifest and tells staff to compare the printed event/gate details. It should not be manually admitted without the event lead's decision. The server also checks the gate and records a mismatch when the scan synchronizes. If local data is stale or ambiguous, direct the student to the event lead instead of treating an offline scan as a pass.”

### “What if the event is canceled or the ticket is revoked while the phone is offline?”

**Answer:** “The administrator's change is authoritative on the server, but the offline phone cannot receive it yet. It may display a provisional local result from its earlier manifest. When it syncs, the API checks current state and can reject that result. That is why staff preloads shortly before opening, refreshes whenever possible, and follows an incident procedure.”

### “Does the dashboard show all people inside?”

**Answer:** “It shows server-recorded admissions and current admin data. A scan still queued on an offline phone has not reached the server, and scanner heartbeat/pending-queue telemetry is not yet available in the metrics API. We should not describe the current dashboard as a complete live occupancy count during an outage.”

### “Why not make every offline scan final?”

**Answer:** “A disconnected phone cannot check changes or scans that happened elsewhere. Calling a local decision final would overstate what that device knows. The system records a fast provisional decision and reconciles it when the authoritative server is reachable.”

### “What is the next half?”

**Answer:** “First we need a repeatable physical demo and event-day procedures. Then we can improve conflict review, account recovery, queue visibility, standalone deployment, and operational testing. The exact percentage depends on our course rubric, so we track completion against rubric items and evidence rather than guessing from code size.”

## Closing

**Say:** “The key design choice is separating immediate local validation from final server reconciliation. That keeps the line moving through a short API outage while making the limitations visible: stale data and disconnected scanners can disagree. Our next work is to prove the end-to-end flow on real devices and give staff a precise procedure for those cases.”

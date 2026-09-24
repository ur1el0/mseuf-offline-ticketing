# ADR 002: RFC 6238 Dynamic TOTP QR Codes over Static Codes

## Status
Accepted

## Context
Traditional ticketing platforms rely on static QR codes containing a ticket UUID or barcode string. In university campus events, attendees frequently take screenshots of their tickets and distribute them to peers via messaging platforms (Messenger, Telegram, AirDrop), resulting in double-admissions and fraudulent gate entry.

## Decision
We enforce a dynamic, offline-generated **RFC 6238 Time-Based One-Time Password (TOTP)** protocol:
1. When a ticket is issued, the server generates a cryptographically secure Base32 seed and encrypts it using AES-256.
2. The student application stores the seed in `expo-secure-store`.
3. Entirely offline, the mobile client calculates a new 6-digit token every 30 seconds using `otpauth`.
4. The QR code dynamically encodes `MSEUF:{ticket_id}:{token}` and refreshes via SVG rendering.

## Consequences
- **Positive:** Screenshots become useless after 30 seconds, defeating screenshot fraud without requiring an active cellular connection on the student phone.
- **Negative:** Requires precise time synchronization between student and scanner devices.
